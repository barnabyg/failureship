import type { Content } from "./content";
import { pick } from "./rng";
import type { Choice, Hotspot, PlayerView, StepView } from "./view";

export interface HiddenTruth {
  fact: { id: string; text: string };
}

type Step = StepView;

interface State {
  seed: number;
  rng: number;
  month: number;
  spent: number;
  visited: string[];
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
    step: { kind: "actions" },
    truth: { fact: dealt.item },
  };

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

/** The month's order: spend actions until none can be spent, then close. */
function nextStep(state: State, content: Content): Step {
  if (content.actions.some((a) => isAvailable(state, content, a))) {
    return { kind: "actions" };
  }
  return { kind: "story", ...content.officialStory };
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
  switch (state.step.kind) {
    case "actions":
      return content.actions
        .filter((a) => isAvailable(state, content, a))
        .map((a) => ({ type: "action", actionId: a.id }));
    case "notice":
      return [{ type: "continue" }];
    case "story":
      return [];
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
    hotspots: content.actions.map((a) => toHotspot(state, content, a)),
    step: state.step,
    hint: content.ui.hints[state.step.kind].replaceAll(
      "{actions}",
      actionsLabel,
    ),
    choices: legalChoices(state, content),
  });
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
    costLabel: content.ui.costLabel.replaceAll(
      "{actions}",
      countActions(content, costOf(content, action.cost)),
    ),
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

function costOf(content: Content, key: string): number {
  return content.balance.actionCosts[key] ?? 0;
}

function countActions(content: Content, n: number): string {
  const { one, other } = content.ui.actionCount;
  return n === 1 ? one : other.replaceAll("{n}", String(n));
}
