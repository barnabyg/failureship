import { makeClaim, type Claim } from "./claims";
import type { Condition, Content, Mood, SceneData } from "./content";
import {
  dealCharacters,
  dealMotives,
  dealPowerMap,
  type DealtCharacter,
  type PowerMap,
} from "./deal";
import { pick, pickWeighted } from "./rng";
import type {
  Buzzword,
  ChartEntry,
  Choice,
  Hotspot,
  NotificationOption,
  Person,
  PlayerView,
  StepView,
} from "./view";

export interface HiddenTruth {
  characters: DealtCharacter[];
  powerMap: PowerMap;
  /** Moved by the player's choices. Shown only through how the boss behaves. */
  bossOpinion: number;
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

/** Which behaviour a Character was seen showing when a Scene opened. */
interface ShownBehaviour {
  character: string;
  behaviour: string;
}

type Step =
  | { kind: "notification"; id: string }
  | { kind: "dialog"; id: string; learned: string[] }
  | { kind: "actions" }
  | {
      kind: "scene";
      id: string;
      shown: ShownBehaviour[];
      treatment: string | null;
    }
  | { kind: "find-out"; method: string }
  | { kind: "claim"; index: number }
  | { kind: "notice"; title: string; body: string }
  | { kind: "move"; id: string }
  | { kind: "story" }
  | { kind: "results" };

/** What belongs to the month, and is wiped when the next one opens. */
interface MonthRecord {
  spent: number;
  visited: string[];
  unanswered: string[];
  flags: string[];
  moveLanded: boolean;
}

/** What belongs to the run, and carries from month to month. */
interface State extends MonthRecord {
  seed: number;
  rng: number;
  month: number;
  buzzwords: string[];
  claims: Claim[];
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
  const dealt = dealCharacters(seed, content);
  const power = dealPowerMap(dealt.next, content);
  const motives = dealMotives(power.next, dealt.characters, content);
  const state: State = {
    seed,
    rng: motives.next,
    month: 1,
    ...freshMonth(content, 1),
    buzzwords: [],
    claims: [],
    step: { kind: "actions" },
    truth: {
      characters: motives.characters,
      powerMap: power.powerMap,
      bossOpinion: 0,
    },
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

function freshMonth(content: Content, month: number): MonthRecord {
  return {
    spent: 0,
    visited: [],
    unanswered: content.notifications
      .filter((n) => inMonth(n, month))
      .map((n) => n.id),
    flags: [],
    moveLanded: false,
  };
}

function inMonth(item: { months?: number[] | undefined }, month: number) {
  return item.months === undefined || item.months.includes(month);
}

/** After the official story: on to the next month, or the end of the run. */
function leaveStory(state: State, world: World): void {
  if (state.month === world.content.balance.monthsPerRun) {
    state.step = { kind: "results" };
    return;
  }
  state.month += 1;
  Object.assign(state, freshMonth(world.content, state.month));
  state.step = nextStep(state, world);
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
      state.flags.push(...action.sets);
      if (action.scene !== undefined) {
        state.step = openScene(state, world, action.scene);
      } else if (action.findOut !== undefined) {
        state.step = { kind: "find-out", method: action.findOut };
      } else if (action.result) {
        state.step = { kind: "notice", ...action.result };
      }
      return;
    }
    case "find-out":
      hearClaim(state, world, choice);
      return;
    case "scene":
      behaveInScene(state, world, choice);
      return;
    case "continue":
      if (state.step.kind === "story") leaveStory(state, world);
      else state.step = nextStep(state, world);
      return;
  }
}

function methodOf(content: Content, id: string) {
  const method = content.sources.methods.find((m) => m.id === id);
  if (!method) throw new Error(`Unknown Find Out "${id}".`);
  return method;
}

function hearClaim(
  state: State,
  { content }: World,
  choice: Extract<Choice, { type: "find-out" }>,
): void {
  if (state.step.kind !== "find-out") {
    throw new IllegalChoiceError(choice.sourceId);
  }
  const made = makeClaim(state.rng, content, {
    month: state.month,
    method: methodOf(content, state.step.method),
    source: choice.sourceId,
    subject: choice.subjectId,
    characters: state.truth.characters,
    powerMap: state.truth.powerMap,
  });
  state.rng = made.next;
  state.claims.push(made.claim);
  state.step = { kind: "claim", index: state.claims.length - 1 };
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
  const learned = option.learns.filter((w) => !state.buzzwords.includes(w));
  state.buzzwords.push(...learned);
  state.flags.push(...option.sets);
  state.truth.bossOpinion += option.opinion;

  if (option.dialog !== undefined) {
    state.step = { kind: "dialog", id: option.dialog, learned };
  } else if (option.result) {
    state.step = { kind: "notice", ...option.result };
  } else {
    state.step = nextStep(state, world);
  }
}

/** Everyone present shows one behaviour, chosen by their dealt kind. */
function openScene(state: State, world: World, id: string): Step {
  const { behaviours } = world.content;
  const shown: ShownBehaviour[] = [];
  const { cast } = sceneData(state, world, id);
  if (behaviours.length > 0) {
    for (const character of cast) {
      const kind = state.truth.characters.find((c) => c.id === character)?.kind;
      if (kind === undefined) continue;
      const chosen = pickWeighted(
        state.rng,
        behaviours,
        (b) => b.likelihood[kind],
      );
      state.rng = chosen.next;
      shown.push({ character, behaviour: chosen.item.id });
    }
  }
  return { kind: "scene", id, shown, treatment: treatBoss(state, world, cast) };
}

function moodOf(state: State, content: Content): Mood {
  const { warmAt, coldAt } = content.balance.opinion;
  if (state.truth.bossOpinion >= warmAt) return "warm";
  return state.truth.bossOpinion <= coldAt ? "cold" : "neutral";
}

/** If the boss is present, one sign of how they treat the player. */
function treatBoss(
  state: State,
  { content }: World,
  cast: readonly string[],
): string | null {
  const { character, signs } = content.boss;
  if (signs.length === 0 || !cast.includes(character)) return null;
  const mood = moodOf(state, content);
  const chosen = pickWeighted(state.rng, signs, (s) => s.likelihood[mood]);
  state.rng = chosen.next;
  return chosen.item.id;
}

function behaveInScene(
  state: State,
  world: World,
  choice: Extract<Choice, { type: "scene" }>,
): void {
  const scene = sceneData(state, world, choice.sceneId);
  const option = offeredOptions(state, world.content, scene).find(
    (o) => o.id === choice.optionId,
  );
  const result = option?.results.find((r) =>
    matches(state, world.content, r.when, scene.cast),
  );
  if (!result) throw new IllegalChoiceError(choice.optionId);
  state.flags.push(...result.sets);
  state.truth.bossOpinion += result.opinion;
  state.step = {
    kind: "notice",
    title: scene.title,
    body: fillRoles(state, world.content, result.body, scene.cast),
  };
}

/** Roles are relative to who is in the room. Left out, that is everyone. */
function rolesIn(powerMap: PowerMap, room?: readonly string[]) {
  const present = powerMap.order.filter((id) => room?.includes(id) ?? true);
  return {
    holder: present[0],
    bystander: present[1],
    ignored: present.at(-1),
  };
}

function matches(
  state: State,
  content: Content,
  condition: Condition | undefined,
  room?: readonly string[],
): boolean {
  if (condition === undefined) return true;
  if ("holderIs" in condition) {
    return condition.holderIs === rolesIn(state.truth.powerMap, room).holder;
  }
  if ("opinionIs" in condition) {
    return condition.opinionIs === moodOf(state, content);
  }
  if ("hasBuzzword" in condition) {
    return state.buzzwords.includes(condition.hasBuzzword);
  }
  if ("flag" in condition) return state.flags.includes(condition.flag);
  if ("not" in condition) return !matches(state, content, condition.not, room);
  return condition.all.every((inner) => matches(state, content, inner, room));
}

function offeredOptions(state: State, content: Content, scene: SceneData) {
  return scene.options.filter((o) => matches(state, content, o.requires));
}

function sceneData(state: State, world: World, id: string): SceneData {
  const scene = world.content.scenes.find((s) => s.id === id);
  if (!scene) throw new Error(`Unknown Scene "${id}".`);
  const script =
    scene.script === undefined ? undefined : world.sceneScripts[scene.script];
  return script ? script(scene, { powerMap: state.truth.powerMap }) : scene;
}

/** Writes the dealt Characters' names into text that names roles. */
function fillRoles(
  state: State,
  content: Content,
  written: string,
  room?: readonly string[],
): string {
  const name = (id: string | undefined) =>
    content.characters.find((c) => c.id === id)?.name ?? "";
  const { holder, ignored, bystander } = rolesIn(state.truth.powerMap, room);
  return written
    .replaceAll("{holder}", name(holder))
    .replaceAll("{ignored}", name(ignored))
    .replaceAll("{bystander}", name(bystander));
}

/** The month's order: Notifications, actions, a Move, then the month closes. */
function nextStep(state: State, { content }: World): Step {
  for (const id of state.unanswered) {
    const notification = content.notifications.find((n) => n.id === id);
    const answerable = notification?.options.some(
      (o) => costOf(content, o.cost) <= remaining(state, content),
    );
    if (answerable) return { kind: "notification", id };
  }
  if (
    actionsThisMonth(state, content).some((a) => isAvailable(state, content, a))
  ) {
    return { kind: "actions" };
  }
  return landMove(state, content) ?? { kind: "story" };
}

/** Picks the month's Character Move from those whose conditions hold. */
function landMove(state: State, content: Content): Step | null {
  if (state.moveLanded) return null;
  state.moveLanded = true;
  const eligible = content.moves.filter(
    (m) => inMonth(m, state.month) && matches(state, content, m.when),
  );
  if (eligible.length === 0) return null;
  const { item, next } = pick(state.rng, eligible);
  state.rng = next;
  state.flags.push(...item.sets);
  return { kind: "move", id: item.id };
}

/** An action exists in a month only if the Scene it opens does too. */
function actionsThisMonth(state: State, content: Content) {
  return content.actions.filter((a) => {
    const scene = content.scenes.find((s) => s.id === a.scene);
    return inMonth(a, state.month) && (!scene || inMonth(scene, state.month));
  });
}

function isAvailable(
  state: State,
  content: Content,
  action: Content["actions"][number],
): boolean {
  return (
    !isDone(state, action) &&
    costOf(content, action.cost) <= remaining(state, content)
  );
}

function isDone(state: State, action: Content["actions"][number]): boolean {
  return action.oncePerMonth && state.visited.includes(action.id);
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
      return actionsThisMonth(state, content)
        .filter((a) => isAvailable(state, content, a))
        .map((a) => ({ type: "action", actionId: a.id }));
    case "scene":
      return offeredOptions(
        state,
        content,
        sceneData(state, world, step.id),
      ).map((o) => ({
        type: "scene",
        sceneId: step.id,
        optionId: o.id,
      }));
    case "find-out":
      return methodOf(content, step.method).sources.flatMap((sourceId) =>
        content.characters
          .filter((c) => c.id !== sourceId)
          .map((c) => ({
            type: "find-out" as const,
            sourceId,
            subjectId: c.id,
          })),
      );
    case "claim":
    case "dialog":
    case "notice":
    case "move":
      return [{ type: "continue" }];
    case "story":
      return [{ type: "continue" }];
    case "results":
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
  { id, shown, treatment }: Extract<Step, { kind: "scene" }>,
): Extract<StepView, { kind: "scene" }> {
  const { content } = world;
  const scene = sceneData(state, world, id);
  const fill = (written: string) =>
    fillRoles(state, content, written, scene.cast);
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
    behaviours: shown.map(({ character, behaviour }) => {
      const who =
        content.characters.find((c) => c.id === character)?.name ?? character;
      const written = content.behaviours.find((b) => b.id === behaviour);
      return { who, text: (written?.text ?? "").replaceAll("{who}", who) };
    }),
    treatment: content.boss.signs.find((s) => s.id === treatment)?.text ?? null,
    options: offeredOptions(state, content, scene).map((o) => ({
      id: o.id,
      label: fill(o.label),
    })),
  };
}

function personOf(content: Content, id: string): Person {
  const known = content.characters.find((c) => c.id === id);
  return { id, name: known?.name ?? id, title: known?.title ?? "" };
}

function toStoryView(
  state: State,
  content: Content,
): Extract<StepView, { kind: "story" }> {
  const { title, reportedHeading, happenedHeading, entries } =
    content.officialStory;
  const told = entries.filter((e) => matches(state, content, e.when));
  const fill = (written: string | undefined) =>
    written === undefined ? [] : [fillRoles(state, content, written)];
  return {
    kind: "story",
    title,
    reportedHeading,
    happenedHeading,
    reported: told.flatMap((e) => fill(e.reported)),
    happened: told.flatMap((e) => fill(e.happened)),
  };
}

/** The reveal. It reaches the player view only here, once the run has ended. */
function toResultsView(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }> {
  const nameOf = (id: string) =>
    content.characters.find((c) => c.id === id)?.name ?? id;
  const { order, influence } = state.truth.powerMap;
  return {
    kind: "results",
    ...content.ui.results,
    characters: state.truth.characters.map((dealt) => {
      const known = content.characters.find((c) => c.id === dealt.id);
      return {
        name: known?.name ?? dealt.id,
        title: known?.title ?? "",
        kind: content.hiddenTruth.kinds[dealt.kind].label,
        fact: dealt.fact?.text ?? null,
      };
    }),
    powerMap: order.map((id) => {
      const above = influence.find((i) => i.over === id);
      return {
        name: nameOf(id),
        title: content.characters.find((c) => c.id === id)?.title ?? "",
        reportsTo: above ? nameOf(above.who) : null,
      };
    }),
    claims: state.claims.map((claim) => {
      const { label, note } = content.sources.verdicts[claim.status];
      const said = state.truth.characters.find((c) => c.id === claim.source);
      const motive = content.sources.motives.find((m) => m.id === said?.motive);
      const source = nameOf(claim.source);
      return {
        month: claim.month,
        source,
        text: claim.text,
        verdict: label,
        note,
        motive: (motive?.text ?? "").replaceAll("{name}", source),
      };
    }),
  };
}

/** The formal hierarchy, the same in every deal. */
function toOrgChart(content: Content): ChartEntry[] {
  return content.characters.map((c) => ({
    name: c.name,
    title: c.title,
    reportsTo:
      content.characters.find((m) => m.id === c.reportsTo)?.name ?? null,
  }));
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
      return toSceneView(state, world, step);
    case "find-out": {
      const method = methodOf(content, step.method);
      return {
        kind: "find-out",
        title: method.title,
        prompt: method.prompt,
        sources: method.sources.map((id) => personOf(content, id)),
        subjects: content.characters.map((c) => personOf(content, c.id)),
      };
    }
    case "claim": {
      const claim = state.claims[step.index];
      if (!claim) throw new Error(`Unknown claim ${String(step.index)}.`);
      const source = personOf(content, claim.source).name;
      return {
        kind: "claim",
        source,
        title: content.ui.claimTitle.replaceAll("{source}", source),
        text: claim.text,
      };
    }
    case "move": {
      const move = content.moves.find((m) => m.id === step.id);
      if (!move) throw new Error(`Unknown Move "${step.id}".`);
      return {
        kind: "move",
        from: move.from,
        title: move.title,
        body: fillRoles(state, content, move.body),
      };
    }
    case "story":
      return toStoryView(state, content);
    case "results":
      return toResultsView(state, content);
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
    totalMonths: content.balance.monthsPerRun,
    actions: {
      total: content.balance.actionsPerMonth,
      spent: state.spent,
      remaining: left,
      label: actionsLabel,
    },
    buzzwords: buzzwordsOf(content, state.buzzwords),
    orgChart: toOrgChart(content),
    hotspots: actionsThisMonth(state, content).map((a) =>
      toHotspot(state, content, a),
    ),
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
  const done = isDone(state, action);
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
