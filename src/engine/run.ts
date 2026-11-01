import type { Content } from "./content";
import { pick } from "./rng";
import type {
  Buzzword,
  Choice,
  Hotspot,
  NotificationOption,
  PlayerView,
  StepView,
} from "./view";

export interface HiddenTruth {
  fact: { id: string; text: string };
}

type Step =
  | { kind: "notification"; id: string }
  | { kind: "dialog"; id: string; learned: string[] }
  | { kind: "actions" }
  | { kind: "notice"; title: string; body: string }
  | { kind: "story" };

interface State {
  seed: number;
  rng: number;
  month: number;
  spent: number;
  visited: string[];
  unanswered: string[];
  buzzwords: string[];
  step: Step;
  truth: HiddenTruth;
}

/** A run in play. The interface only ever sees its player view. */
export interface Run {
  view(): PlayerView;
  /** Applies a legal choice and returns the new view. Throws on any other. */
  choose(choice: Choice): PlayerView;
}

export class IllegalChoiceError extends Error {
  override name = "IllegalChoiceError";
}

const truths = new WeakMap<Run, () => HiddenTruth>();

/** Reads the true state of a run. Exposed through `./hidden-truth` only. */
export function hiddenTruthOf(run: Run): HiddenTruth {
  const read = truths.get(run);
  if (!read) throw new Error("Not a run started by this engine.");
  return read();
}

export function startRun(options: { seed: number; content: Content }): Run {
  const { seed, content } = options;
  const dealt = pick(seed, content.hiddenTruth.facts);
  const state: State = {
    seed,
    rng: dealt.next,
    month: 1,
    spent: 0,
    visited: [],
    unanswered: content.notifications.map((n) => n.id),
    buzzwords: [],
    step: { kind: "actions" },
    truth: { fact: dealt.item },
  };
  state.step = nextStep(state, content);

  const view = () => toView(state, content);
  const run: Run = {
    view,
    choose(choice) {
      const legal = legalChoices(state, content);
      const wanted = JSON.stringify(choice);
      if (!legal.some((c) => JSON.stringify(c) === wanted)) {
        throw new IllegalChoiceError(`Choice not available now: ${wanted}`);
      }
      apply(state, content, choice);
      return view();
    },
  };
  truths.set(run, () => structuredClone(state.truth));
  return run;
}

function apply(state: State, content: Content, choice: Choice): void {
  switch (choice.type) {
    case "notification":
      answerNotification(state, content, choice);
      return;
    case "action": {
      const action = content.actions.find((a) => a.id === choice.actionId);
      if (!action) throw new IllegalChoiceError(choice.actionId);
      state.spent += costOf(content, action.cost);
      state.visited.push(action.id);
      state.step = { kind: "notice", ...action.result };
      return;
    }
    case "continue":
      state.step = nextStep(state, content);
      return;
  }
}

function answerNotification(
  state: State,
  content: Content,
  choice: Extract<Choice, { type: "notification" }>,
): void {
  const option = content.notifications
    .find((n) => n.id === choice.notificationId)
    ?.options.find((o) => o.id === choice.optionId);
  if (!option) throw new IllegalChoiceError(choice.optionId);

  state.spent += costOf(content, option.cost);
  state.unanswered = state.unanswered.filter(
    (id) => id !== choice.notificationId,
  );
  state.buzzwords.push(...option.learns);

  if (option.dialog !== undefined) {
    state.step = { kind: "dialog", id: option.dialog, learned: option.learns };
  } else if (option.result) {
    state.step = { kind: "notice", ...option.result };
  } else {
    state.step = nextStep(state, content);
  }
}

/** The month's order: Notifications, then actions, then the month closes. */
function nextStep(state: State, content: Content): Step {
  for (const id of state.unanswered) {
    const notification = content.notifications.find((n) => n.id === id);
    const answerable = notification?.options.some(
      (o) => costOf(content, o.cost) <= remaining(state, content),
    );
    if (answerable) return { kind: "notification", id };
  }
  if (content.actions.some((a) => isAvailable(state, content, a))) {
    return { kind: "actions" };
  }
  return { kind: "story" };
}

function isAvailable(
  state: State,
  content: Content,
  action: Content["actions"][number],
): boolean {
  return (
    !state.visited.includes(action.id) &&
    costOf(content, action.cost) <= remaining(state, content)
  );
}

function legalChoices(state: State, content: Content): Choice[] {
  const { step } = state;
  switch (step.kind) {
    case "notification":
      return notificationOptions(state, content, step.id)
        .filter((o) => o.affordable)
        .map((o) => ({
          type: "notification",
          notificationId: step.id,
          optionId: o.id,
        }));
    case "actions":
      return content.actions
        .filter((a) => isAvailable(state, content, a))
        .map((a) => ({ type: "action", actionId: a.id }));
    case "dialog":
    case "notice":
      return [{ type: "continue" }];
    case "story":
      return [];
  }
}

function notificationOptions(
  state: State,
  content: Content,
  id: string,
): NotificationOption[] {
  const notification = content.notifications.find((n) => n.id === id);
  return (notification?.options ?? []).map((o) => ({
    id: o.id,
    label: o.label,
    costLabel: costLabel(content, o.cost),
    affordable: costOf(content, o.cost) <= remaining(state, content),
  }));
}

function toStepView(state: State, content: Content): StepView {
  const { step } = state;
  switch (step.kind) {
    case "notification": {
      const n = content.notifications.find((x) => x.id === step.id);
      if (!n) throw new Error(`Unknown Notification "${step.id}".`);
      return {
        kind: "notification",
        id: n.id,
        from: n.from,
        subject: n.subject,
        body: n.body,
        options: notificationOptions(state, content, n.id),
      };
    }
    case "dialog": {
      const dialog = content.dialogs.find((d) => d.id === step.id);
      if (!dialog) throw new Error(`Unknown dialog "${step.id}".`);
      return {
        kind: "dialog",
        title: dialog.title,
        lines: dialog.lines,
        learned: buzzwordsOf(content, step.learned),
      };
    }
    case "story":
      return { kind: "story", ...content.officialStory };
    case "actions":
    case "notice":
      return step;
  }
}

function toView(state: State, content: Content): PlayerView {
  const left = remaining(state, content);
  const actionsLabel = countActions(content, left);
  return structuredClone({
    seed: state.seed,
    month: state.month,
    actions: {
      total: content.balance.actionsPerMonth,
      spent: state.spent,
      remaining: left,
      label: actionsLabel,
    },
    buzzwords: buzzwordsOf(content, state.buzzwords),
    hotspots: content.actions.map((a) => toHotspot(state, content, a)),
    step: toStepView(state, content),
    hint: content.ui.hints[state.step.kind].replaceAll(
      "{actions}",
      actionsLabel,
    ),
    choices: legalChoices(state, content),
  });
}

function buzzwordsOf(content: Content, ids: readonly string[]): Buzzword[] {
  return content.buzzwords.filter((b) => ids.includes(b.id));
}

function toHotspot(
  state: State,
  content: Content,
  action: Content["actions"][number],
): Hotspot {
  const done = state.visited.includes(action.id);
  return {
    id: action.id,
    label: action.label,
    description: action.description,
    place: action.place,
    costLabel: costLabel(content, action.cost),
    state: done
      ? "done"
      : isAvailable(state, content, action)
        ? "available"
        : "unavailable",
  };
}

function remaining(state: State, content: Content): number {
  return content.balance.actionsPerMonth - state.spent;
}

function costOf(content: Content, key: string | undefined): number {
  return key === undefined ? 0 : (content.balance.actionCosts[key] ?? 0);
}

function costLabel(content: Content, key: string | undefined): string {
  const cost = costOf(content, key);
  return cost === 0
    ? content.ui.freeLabel
    : content.ui.costLabel.replaceAll("{actions}", countActions(content, cost));
}

function countActions(content: Content, n: number): string {
  const { one, other } = content.ui.actionCount;
  return n === 1 ? one : other.replaceAll("{n}", String(n));
}
