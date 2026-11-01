import type { Condition, Content, SceneData } from "./content";
import { pick } from "./rng";
import type {
  Buzzword,
  Choice,
  Hotspot,
  NotificationOption,
  PlayerView,
  StepView,
} from "./view";

export interface PowerMap {
  holder: string;
  ignored: string;
  bystander: string;
}

export interface HiddenTruth {
  fact: { id: string; text: string };
  powerMap: PowerMap;
}

/** Custom behaviour for a Scene: reshapes its data for the current truth. */
export type SceneScript = (
  scene: SceneData,
  context: { powerMap: PowerMap },
) => SceneData;

type SceneScripts = Readonly<Record<string, SceneScript>>;

interface World {
  content: Content;
  sceneScripts: SceneScripts;
}

type Step =
  | { kind: "notification"; id: string }
  | { kind: "dialog"; id: string; learned: string[] }
  | { kind: "actions" }
  | { kind: "scene"; id: string }
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

export function startRun(options: {
  seed: number;
  content: Content;
  sceneScripts?: SceneScripts;
}): Run {
  const { seed, content, sceneScripts = {} } = options;
  for (const scene of content.scenes) {
    if (scene.script !== undefined && !(scene.script in sceneScripts)) {
      throw new Error(
        `Scene "${scene.id}" needs missing script "${scene.script}".`,
      );
    }
  }
  const world: World = { content, sceneScripts };
  const fact = pick(seed, content.hiddenTruth.facts);
  const dealt = dealPowerMap(fact.next, content.hiddenTruth.cast);
  const state: State = {
    seed,
    rng: dealt.next,
    month: 1,
    spent: 0,
    visited: [],
    unanswered: content.notifications.map((n) => n.id),
    buzzwords: [],
    step: { kind: "actions" },
    truth: { fact: fact.item, powerMap: dealt.powerMap },
  };
  state.step = nextStep(state, world);

  const view = () => toView(state, world);
  const run: Run = {
    view,
    choose(choice) {
      const legal = legalChoices(state, world);
      const wanted = JSON.stringify(choice);
      if (!legal.some((c) => JSON.stringify(c) === wanted)) {
        throw new IllegalChoiceError(`Choice not available now: ${wanted}`);
      }
      apply(state, world, choice);
      return view();
    },
  };
  truths.set(run, () => structuredClone(state.truth));
  return run;
}

function dealPowerMap(
  rng: number,
  cast: readonly string[],
): { powerMap: PowerMap; next: number } {
  const holder = pick(rng, cast);
  const others = cast.filter((c) => c !== holder.item);
  const ignored = pick(holder.next, others);
  const bystander = pick(
    ignored.next,
    others.filter((c) => c !== ignored.item),
  );
  return {
    powerMap: {
      holder: holder.item,
      ignored: ignored.item,
      bystander: bystander.item,
    },
    next: bystander.next,
  };
}

function apply(state: State, world: World, choice: Choice): void {
  const { content } = world;
  switch (choice.type) {
    case "notification":
      answerNotification(state, world, choice);
      return;
    case "action": {
      const action = content.actions.find((a) => a.id === choice.actionId);
      if (!action) throw new IllegalChoiceError(choice.actionId);
      state.spent += costOf(content, action.cost);
      state.visited.push(action.id);
      if (action.scene !== undefined) {
        state.step = { kind: "scene", id: action.scene };
      } else if (action.result) {
        state.step = { kind: "notice", ...action.result };
      }
      return;
    }
    case "scene":
      behaveInScene(state, world, choice);
      return;
    case "continue":
      state.step = nextStep(state, world);
      return;
  }
}

function answerNotification(
  state: State,
  world: World,
  choice: Extract<Choice, { type: "notification" }>,
): void {
  const { content } = world;
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
    state.step = nextStep(state, world);
  }
}

function behaveInScene(
  state: State,
  world: World,
  choice: Extract<Choice, { type: "scene" }>,
): void {
  const scene = sceneData(state, world, choice.sceneId);
  const option = scene.options.find((o) => o.id === choice.optionId);
  const result = option?.results.find((r) => matches(state, r.when));
  if (!result) throw new IllegalChoiceError(choice.optionId);
  state.step = {
    kind: "notice",
    title: scene.title,
    body: fillRoles(state, world.content, result.body),
  };
}

function matches(state: State, condition: Condition | undefined): boolean {
  return (
    condition === undefined ||
    condition.holderIs === state.truth.powerMap.holder
  );
}

function sceneData(state: State, world: World, id: string): SceneData {
  const scene = world.content.scenes.find((s) => s.id === id);
  if (!scene) throw new Error(`Unknown Scene "${id}".`);
  const script =
    scene.script === undefined ? undefined : world.sceneScripts[scene.script];
  return script ? script(scene, { powerMap: state.truth.powerMap }) : scene;
}

/** Writes the dealt Characters' names into text that names roles. */
function fillRoles(state: State, content: Content, written: string): string {
  const name = (id: string) =>
    content.characters.find((c) => c.id === id)?.name ?? id;
  const { holder, ignored, bystander } = state.truth.powerMap;
  return written
    .replaceAll("{holder}", name(holder))
    .replaceAll("{ignored}", name(ignored))
    .replaceAll("{bystander}", name(bystander));
}

/** The month's order: Notifications, then actions, then the month closes. */
function nextStep(state: State, { content }: World): Step {
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

function legalChoices(state: State, world: World): Choice[] {
  const { content } = world;
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
    case "scene":
      return sceneData(state, world, step.id).options.map((o) => ({
        type: "scene",
        sceneId: step.id,
        optionId: o.id,
      }));
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

function toSceneView(
  state: State,
  world: World,
  id: string,
): Extract<StepView, { kind: "scene" }> {
  const { content } = world;
  const fill = (written: string) => fillRoles(state, content, written);
  const scene = sceneData(state, world, id);
  return {
    kind: "scene",
    id: scene.id,
    title: scene.title,
    location: scene.location,
    narration: scene.narration.map(fill),
    cast: scene.cast.flatMap((c) =>
      content.characters
        .filter((x) => x.id === c)
        .map((x) => ({ name: x.name, title: x.title })),
    ),
    signs: scene.signs.map((s) => ({ label: s.label, text: fill(s.text) })),
    options: scene.options.map((o) => ({ id: o.id, label: fill(o.label) })),
  };
}

function toStepView(state: State, world: World): StepView {
  const { content } = world;
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
    case "scene":
      return toSceneView(state, world, step.id);
    case "story":
      return { kind: "story", ...content.officialStory };
    case "actions":
    case "notice":
      return step;
  }
}

function toView(state: State, world: World): PlayerView {
  const { content } = world;
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
    step: toStepView(state, world),
    hint: content.ui.hints[state.step.kind].replaceAll(
      "{actions}",
      actionsLabel,
    ),
    choices: legalChoices(state, world),
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
