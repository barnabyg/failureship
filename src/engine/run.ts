import { makeClaim, verdictOfClaim, type Claim } from "./claims";
import {
  KINDS,
  behavioursOpenTo,
  chasedIdOf,
  everyNotification,
  type ClueVerdict,
  type Condition,
  type Content,
  type Kind,
  type Mood,
  type SceneData,
} from "./content";
import {
  dealCharacters,
  dealMotives,
  dealPowerMap,
  type DealtCharacter,
  type PowerMap,
} from "./deal";
import { draw, drawFor, pick, pickWeighted } from "./rng";
import { calledBy, capitalised, sayPeople } from "./say";
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
  | {
      kind: "dialog";
      id: string;
      learned: string[];
      reaction?: string | undefined;
    }
  | { kind: "actions" }
  | {
      kind: "scene";
      id: string;
      shown: ShownBehaviour[];
      treatment: string | null;
      /** Whether this Scene's signs point at the wrong person. */
      misleading: boolean;
    }
  | { kind: "find-out"; method: string; sources: string[] }
  | { kind: "claim"; index: number }
  | {
      kind: "notice";
      title: string;
      body: string;
      /** How the boss took it. Signs only: it never says the boss's kind. */
      reaction?: string | undefined;
      verdict?: string | undefined;
    }
  | { kind: "move"; id: string }
  | { kind: "story" }
  | { kind: "results" };

interface Clue {
  month: number;
  source: string;
  text: string;
  verdict: ClueVerdict;
}

/** How one choice came across to the boss, for the results screen. */
interface BossLanding {
  month: number;
  choice: string;
  shift: number;
}

/** A written event in the Project's life, which the player can read back. */
interface ProjectNews {
  month: number;
  text: string;
}

/** What belongs to the month, and is wiped when the next one opens. */
interface MonthRecord {
  noted: string[];
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
  /** So that a Move does not land twice in a run while others remain. */
  movesLanded: string[];
  clues: Clue[];
  /** Who the player suspects of what. Nothing in the rules ever reads this. */
  marks: Map<string, Kind>;
  /** Who the player was last told has each Hidden Fact, true or not. */
  heard: { fact: string; subject: string }[];
  factEvents: { month: number; note: string; fact: string | null }[];
  bossLandings: BossLanding[];
  /** How often each approach has been used, since some can be overdone. */
  approachUses: Record<string, number>;
  verdict: string | null;
  /** Demands the player stalled, which stay open until forgotten or answered. */
  openDemands: { id: string; month: number; chased: boolean }[];
  /** What the player is told before anything else, as a month opens. */
  noticesDue: { title: string; body: string }[];
  project: {
    real: string;
    reported: string;
    news: ProjectNews[];
    /** Flagged, and not yet explained. */
    flagged: boolean;
  };
  step: Step;
  truth: HiddenTruth;
}

/** A run in play. The interface only ever sees its player view. */
export interface Run {
  view(): PlayerView;
  /** Applies a legal choice and returns the new view. Throws on any other. */
  choose(choice: Choice): PlayerView;
  /** Sets or clears a suspicion, at no cost. Throws once the run has ended. */
  mark(character: string, kind: Kind | null): PlayerView;
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
    movesLanded: [],
    clues: [],
    marks: new Map(),
    heard: [],
    factEvents: [],
    bossLandings: [],
    approachUses: {},
    verdict: null,
    openDemands: [],
    noticesDue: [],
    project: { ...content.project.start, news: [], flagged: false },
    step: { kind: "actions" },
    truth: {
      characters: motives.characters,
      powerMap: power.powerMap,
      bossOpinion: 0,
    },
  };
  openMonth(state, content);
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
      noteEvents(state, content);
      return view();
    },
    mark(character, kind) {
      const known = content.characters.some((c) => c.id === character);
      const legal = kind === null || KINDS.includes(kind);
      if (state.step.kind === "results" || !known || !legal) {
        throw new IllegalChoiceError(`Cannot mark ${character}.`);
      }
      if (kind === null) state.marks.delete(character);
      else state.marks.set(character, kind);
      return view();
    },
  };
  truths.set(run, () => structuredClone(state.truth));
  return run;
}

function freshMonth(content: Content, month: number): MonthRecord {
  return {
    noted: [],
    spent: 0,
    visited: [],
    // What belongs to this month first, and what recurs, like the report, last.
    unanswered: [...content.notifications, ...(content.demands?.items ?? [])]
      .filter((n) => inMonth(n, month))
      .sort((a, b) => Number(!a.months) - Number(!b.months))
      .map((n) => n.id),
    flags: [],
    moveLanded: false,
  };
}

/** What happens as a month opens, whatever the player has done. */
function openMonth(state: State, content: Content): void {
  followUpDemands(state, content);
  const { input } = content.project;
  const late = state.truth.characters.find((c) => c.id === input?.character);
  if (input && late && inMonth(input, state.month)) {
    const value = drawFor(state.seed, "report-input", state.month);
    if (value < input.chance[late.kind]) state.flags.push(input.sets);
  }
  for (const event of content.project.events) {
    if (inMonth(event, state.month)) {
      moveProject(state, content, event.project);
      state.project.news.push({ month: state.month, text: event.text });
    }
  }
}

/** A stalled Demand gets a seeded draw each later month: forgotten, chased or neither. */
function followUpDemands(state: State, content: Content): void {
  const { demands } = content;
  if (!demands) return;
  const kind = bossKindOf(state, content);
  const { forgets, chases } = demands.odds[kind];
  for (const open of [...state.openDemands]) {
    const item = demands.items.find((d) => d.id === open.id);
    if (!item || open.chased) continue;
    const value = drawFor(state.seed, `demand:${open.id}`, state.month);
    if (value < forgets) {
      state.openDemands = state.openDemands.filter((d) => d !== open);
      state.noticesDue.push(item.forgotten);
      state.flags.push(demands.sets.forgotten);
    } else if (value < forgets + chases) {
      open.chased = true;
      state.unanswered.unshift(chasedIdOf(open.id));
      state.flags.push(demands.sets.chased);
      landWithBoss(
        state,
        content,
        { opinion: demands.chasedPenalty[kind] },
        item.chased.subject,
      );
    }
  }
}

function moveProject(
  state: State,
  content: Content,
  change: { real?: string | undefined; reported?: string | undefined } = {},
): void {
  const { statuses } = content.project;
  const { project } = state;
  const moved = (from: string, to: string | undefined): string => {
    const index = statuses.findIndex((s) => s.id === from);
    if (to === "better") return statuses[Math.max(index - 1, 0)]?.id ?? from;
    if (to === "worse") {
      return statuses[Math.min(index + 1, statuses.length - 1)]?.id ?? from;
    }
    if (to === "real") return project.real;
    return to ?? from;
  };
  project.real = moved(project.real, change.real);
  const was = project.reported;
  project.reported = moved(was, change.reported);
  const at = content.project.flagged?.at;
  if (project.reported === at && was !== at) project.flagged = true;
}

function inMonth(item: { months?: number[] | undefined }, month: number) {
  return item.months === undefined || item.months.includes(month);
}

function noteEvents(state: State, content: Content): void {
  for (const event of content.notebook.events) {
    if (
      !state.noted.includes(event.id) &&
      inMonth(event, state.month) &&
      matches(state, content, event.when)
    ) {
      state.noted.push(event.id);
      state.clues.push({
        month: state.month,
        source: event.source,
        text: event.text,
        verdict: event.verdict,
      });
    }
  }
}

/** After the official story: on to the next month, or the end of the run. */
function leaveStory(state: State, world: World): void {
  if (state.month === world.content.balance.monthsPerRun) {
    state.step = { kind: "results" };
    return;
  }
  state.month += 1;
  Object.assign(state, freshMonth(world.content, state.month));
  openMonth(state, world.content);
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
      moveProject(state, content, action.project);
      const reaction = landWithBoss(state, content, action, action.label);
      if (action.scene !== undefined) {
        state.step = openScene(state, world, action.scene);
      } else if (action.findOut !== undefined) {
        state.step = arriveToFindOut(state, content, action.findOut);
      } else if (action.result) {
        const results = [action.result, ...action.moreResults];
        const result = results[(state.month - 1) % results.length];
        state.step = { kind: "notice", ...(result ?? action.result), reaction };
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

/** Who is there to ask: whoever happens to be there, or a choice of them. */
function arriveToFindOut(state: State, content: Content, id: string): Step {
  const method = methodOf(content, id);
  if (!method.someoneThere) {
    return { kind: "find-out", method: id, sources: method.sources };
  }
  const there = pick(state.rng, method.sources);
  state.rng = there.next;
  return { kind: "find-out", method: id, sources: [there.item] };
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
  state.clues.push({
    month: state.month,
    source: capitalised(calledBy(content, made.claim.source)),
    text: made.claim.text,
    verdict: verdictOfClaim(content, made.claim),
  });
  const { factId, subject } = made.claim;
  if (factId !== null) {
    state.heard = state.heard.filter((h) => h.fact !== factId);
    state.heard.push({ fact: factId, subject });
  }
  state.step = { kind: "claim", index: state.claims.length - 1 };
}

function answerNotification(
  state: State,
  world: World,
  choice: Extract<Choice, { type: "notification" }>,
): void {
  const { content } = world;
  const option = everyNotification(content)
    .find((n) => n.id === choice.notificationId)
    ?.options.find((o) => o.id === choice.optionId);
  if (!option) throw new IllegalChoiceError(choice.optionId);
  if (option.stalls) {
    state.openDemands.push({
      id: choice.notificationId,
      month: state.month,
      chased: false,
    });
  }
  state.openDemands = state.openDemands.filter(
    (d) => chasedIdOf(d.id) !== choice.notificationId,
  );

  state.spent += costOf(content, option.cost);
  state.unanswered = state.unanswered.filter(
    (id) => id !== choice.notificationId,
  );
  const learned = option.learns.filter((w) => !state.buzzwords.includes(w));
  state.buzzwords.push(...learned);
  const lost =
    option.bet &&
    drawFor(state.seed, option.id, state.month) >= option.bet.chance
      ? option.bet.lost
      : undefined;
  const outcome = lost ?? option;
  state.flags.push(...outcome.sets);
  moveProject(state, content, outcome.project);
  const reaction = landWithBoss(state, content, outcome, option.label);

  if (option.dialog !== undefined) {
    state.step = { kind: "dialog", id: option.dialog, learned, reaction };
  } else if (outcome.result) {
    state.step = { kind: "notice", ...outcome.result, reaction };
  } else {
    state.step = nextStep(state, world);
  }
}

function bossKindOf(state: State, content: Content): Kind {
  const dealt = state.truth.characters.find(
    (c) => c.id === content.boss.character,
  );
  if (!dealt) throw new Error("The boss was not dealt.");
  return dealt.kind;
}

/**
 * Moves the boss's opinion by what the choice says, and by how this kind of
 * boss takes its approach. Returns the sign of that, if it has one.
 */
function landWithBoss(
  state: State,
  content: Content,
  choice: {
    opinion?: number;
    approach?: string | undefined;
    reaction?: Readonly<Record<Kind, string>> | undefined;
  },
  label: string,
): string | undefined {
  const kind = bossKindOf(state, content);
  const approach = content.boss.approaches.find(
    (a) => a.id === choice.approach,
  );
  const uses = approach ? (state.approachUses[approach.id] ?? 0) + 1 : 0;
  if (approach) state.approachUses[approach.id] = uses;
  const overdone =
    approach?.overdone && uses > approach.overdone.after
      ? approach.overdone
      : undefined;
  const shift =
    (choice.opinion ?? 0) +
    (overdone?.shift[kind] ?? approach?.shift[kind] ?? 0);
  state.truth.bossOpinion += shift;
  if (approach === undefined && shift === 0) return undefined;
  state.bossLandings.push({ month: state.month, choice: label, shift });
  if (approach === undefined) return undefined;
  const lines = overdone?.reaction[kind];
  if (lines) return lines[(state.month - 1) % lines.length];
  const usual = approach.reaction[kind];
  return choice.reaction?.[kind] ?? usual[(state.month - 1) % usual.length];
}

/** Everyone present shows one behaviour, open to their role and chosen by their dealt kind. */
function openScene(state: State, world: World, id: string): Step {
  const { content } = world;
  const shown: ShownBehaviour[] = [];
  const { cast } = sceneData(state, world, id);
  const misleading = drawMisleading(state, world.content);
  if (content.behaviours.length > 0) {
    for (const character of cast) {
      const kind = state.truth.characters.find((c) => c.id === character)?.kind;
      if (kind === undefined) continue;
      const chosen = pickWeighted(
        state.rng,
        behavioursOpenTo(content, character),
        (b) => b.likelihood[kind],
      );
      state.rng = chosen.next;
      shown.push({ character, behaviour: chosen.item.id });
    }
  }
  noteScene(state, world, id, shown, misleading);
  return {
    kind: "scene",
    id,
    shown,
    treatment: treatBoss(state, world, cast),
    misleading,
  };
}

/** Sometimes a room gives the wrong impression, so no one Scene settles it. */
function drawMisleading(state: State, content: Content): boolean {
  const chance = content.balance.signsMisleadChance;
  if (chance === 0) return false;
  const { value, next } = draw(state.rng);
  state.rng = next;
  return value < chance;
}

/** The Notebook keeps only the signs written with a clue. */
function noteScene(
  state: State,
  world: World,
  id: string,
  shown: readonly ShownBehaviour[],
  misleading: boolean,
): void {
  const { content } = world;
  const scene = sceneData(state, world, id);
  const note = (text: string, verdict: ClueVerdict) => {
    state.clues.push({
      month: state.month,
      source: scene.title,
      text,
      verdict,
    });
  };
  for (const sign of scene.signs) {
    if (sign.clue !== undefined) {
      note(
        fillParts(state, content, sign.clue, scene.cast, misleading),
        misleading ? "wrong" : "held",
      );
    }
  }
  for (const { character, behaviour } of shown) {
    const written = content.behaviours.find((b) => b.id === behaviour);
    const kind = state.truth.characters.find((c) => c.id === character)?.kind;
    if (written?.clue === undefined || kind === undefined) continue;
    const top = Math.max(...Object.values(written.likelihood));
    note(
      sayPeople(written.clue, { "{who}": calledBy(content, character) }),
      written.likelihood[kind] === top ? "held" : "wrong",
    );
  }
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
  moveProject(state, world.content, result.project);
  const heard = heardAbout(state, option?.about);
  const fill = (written: string) =>
    fillSubject(
      state,
      world.content,
      option?.about,
      fillParts(state, world.content, written, scene.cast),
    );
  const reaction = landWithBoss(
    state,
    world.content,
    result,
    fill(option?.label ?? ""),
  );
  const verdict = scene.verdict?.[moodOf(state, world.content)];
  if (verdict !== undefined) state.verdict = verdict;
  if (result.factNote !== undefined) {
    const dealt = state.truth.characters.find(
      (c) => c.id === (result.factAt ?? heard?.subject),
    )?.fact;
    // Acting on a false claim says nothing about the fact they really have.
    const relevant = option?.about === undefined || dealt?.id === option.about;
    state.factEvents.push({
      month: state.month,
      note: fill(result.factNote),
      fact: relevant ? (dealt?.text ?? null) : null,
    });
  }
  state.step = {
    kind: "notice",
    title: scene.title,
    body: fill(result.body),
    reaction,
    verdict,
  };
}

function heardAbout(state: State, fact: string | undefined) {
  return state.heard.find((h) => h.fact === fact);
}

/** Writes in whoever the player was told has this Hidden Fact. */
function fillSubject(
  state: State,
  content: Content,
  fact: string | undefined,
  written: string,
): string {
  const heard = heardAbout(state, fact);
  return sayPeople(written, {
    "{subject}": heard ? calledBy(content, heard.subject) : "",
  });
}

/** Parts are relative to who is in the room. Left out, that is everyone. */
function partsIn(powerMap: PowerMap, room?: readonly string[]) {
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
    return condition.holderIs === partsIn(state.truth.powerMap, room).holder;
  }
  if ("bossIs" in condition) {
    return bossKindOf(state, content) === condition.bossIs;
  }
  if ("factNature" in condition) {
    const { character, nature } = condition.factNature;
    const dealt = state.truth.characters.find((c) => c.id === character);
    const fact = content.hiddenTruth.facts.find(
      (f) => f.id === dealt?.fact?.id,
    );
    return fact?.nature === nature;
  }
  if ("heardFact" in condition) {
    return heardAbout(state, condition.heardFact) !== undefined;
  }
  if ("heardTrue" in condition) {
    const heard = heardAbout(state, condition.heardTrue);
    const dealt = state.truth.characters.find((c) => c.id === heard?.subject);
    return dealt?.fact?.id === condition.heardTrue;
  }
  if ("hasBuzzword" in condition) {
    return state.buzzwords.includes(condition.hasBuzzword);
  }
  if ("flag" in condition) return state.flags.includes(condition.flag);
  if ("not" in condition) return !matches(state, content, condition.not, room);
  return condition.all.every((inner) => matches(state, content, inner, room));
}

function offeredOptions(state: State, content: Content, scene: SceneData) {
  return scene.options.filter(
    (o) =>
      (o.about === undefined || heardAbout(state, o.about) !== undefined) &&
      matches(state, content, o.requires),
  );
}

function sceneData(state: State, world: World, id: string): SceneData {
  const scene = world.content.scenes.find((s) => s.id === id);
  if (!scene) throw new Error(`Unknown Scene "${id}".`);
  const script =
    scene.script === undefined ? undefined : world.sceneScripts[scene.script];
  return script ? script(scene, { powerMap: state.truth.powerMap }) : scene;
}

/** Writes the dealt Characters into text that names parts in the Power Map. */
function fillParts(
  state: State,
  content: Content,
  written: string,
  room?: readonly string[],
  misleading = false,
): string {
  const who = (id: string | undefined) =>
    id === undefined ? "" : calledBy(content, id);
  const { holder, ignored, bystander } = partsIn(state.truth.powerMap, room);
  return sayPeople(written, {
    "{holder}": who(misleading ? bystander : holder),
    "{ignored}": who(ignored),
    "{bystander}": who(misleading ? holder : bystander),
  });
}

/** The month's order: Notifications, actions, a Move, then the month closes. */
function nextStep(state: State, world: World): Step {
  const { content } = world;
  const due = state.noticesDue.shift();
  if (due) return { kind: "notice", ...due };
  const notifications = everyNotification(content);
  for (const id of state.unanswered) {
    const notification = notifications.find((n) => n.id === id);
    const answerable = notification?.options.some(
      (o) => costOf(content, o.cost) <= remaining(state, content),
    );
    if (answerable && matches(state, content, notification?.when)) {
      return { kind: "notification", id };
    }
  }
  const { flagged } = content.project;
  if (flagged && state.project.flagged) {
    state.project.flagged = false;
    state.spent = Math.min(
      content.balance.actionsPerMonth,
      state.spent + costOf(content, flagged.cost),
    );
    return openScene(state, world, flagged.scene);
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
  const fresh = eligible.filter((m) => !state.movesLanded.includes(m.id));
  const urgent = fresh.filter((m) => m.priority);
  const pool = urgent.length > 0 ? urgent : fresh;
  const { item, next } = pick(state.rng, pool.length > 0 ? pool : eligible);
  state.rng = next;
  state.movesLanded.push(item.id);
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
      return step.sources.flatMap((sourceId) =>
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
  const notification = everyNotification(content).find((n) => n.id === id);
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
  { id, shown, treatment, misleading }: Extract<Step, { kind: "scene" }>,
): Extract<StepView, { kind: "scene" }> {
  const { content } = world;
  const scene = sceneData(state, world, id);
  const fill = (written: string) =>
    fillParts(state, content, written, scene.cast);
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
    signs: scene.signs.map((s) => ({
      label: s.label,
      text: fillParts(state, content, s.text, scene.cast, misleading),
    })),
    behaviours: shown.map(({ character, behaviour }) => {
      const who = calledBy(content, character);
      const written = content.behaviours.find((b) => b.id === behaviour);
      return {
        who,
        text: sayPeople(written?.text ?? "", { "{who}": who }),
      };
    }),
    treatment: content.boss.signs.find((s) => s.id === treatment)?.text ?? null,
    options: offeredOptions(state, content, scene).map((o) => ({
      id: o.id,
      label: fillSubject(state, content, o.about, fill(o.label)),
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
  const told = entries.filter(
    (e) => inMonth(e, state.month) && matches(state, content, e.when),
  );
  const fill = (written: string | undefined) =>
    written === undefined ? [] : [fillParts(state, content, written)];
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
    marks: state.truth.characters.map((dealt) => {
      const mark = state.marks.get(dealt.id) ?? null;
      const { kinds } = content.hiddenTruth;
      return {
        name: nameOf(dealt.id),
        title: personOf(content, dealt.id).title,
        mark: mark === null ? null : kinds[mark].label,
        truth: kinds[dealt.kind].label,
        correct: mark === dealt.kind,
      };
    }),
    clues: state.clues.map(({ month, source, text, verdict }) => ({
      month,
      source,
      text,
      verdict: content.ui.clueVerdicts[verdict],
    })),
    factEvents: state.factEvents,
    boss: toBossResults(state, content),
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

function toBossResults(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }>["boss"] {
  const { warmer, cooler, unmoved } = content.ui.bossLanded;
  const { name, title } = personOf(content, content.boss.character);
  return {
    name,
    title,
    kind: content.hiddenTruth.kinds[bossKindOf(state, content)].label,
    // Missing the Scene does not spare the player: the verdict is given anyway.
    verdict:
      state.verdict ??
      content.scenes.find((s) => s.verdict)?.verdict?.[
        moodOf(state, content)
      ] ??
      null,
    choices: state.bossLandings.map(({ month, choice, shift }) => ({
      month,
      choice,
      landed: shift > 0 ? warmer : shift < 0 ? cooler : unmoved,
    })),
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
      const n = everyNotification(content).find((x) => x.id === step.id);
      if (!n) throw new Error(`Unknown Notification "${step.id}".`);
      return {
        kind: "notification",
        id: n.id,
        from: n.from,
        subject: n.subject,
        body: n.body
          .replaceAll("{real}", statusLabel(content, state.project.real))
          .replaceAll(
            "{reported}",
            statusLabel(content, state.project.reported),
          ),
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
        reaction: step.reaction,
      };
    }
    case "scene":
      return toSceneView(state, world, step);
    case "find-out": {
      const method = methodOf(content, step.method);
      const sources = step.sources.map((id) => personOf(content, id));
      return {
        kind: "find-out",
        title: method.title,
        prompt: sayPeople(method.prompt, {
          "{source}": calledBy(content, sources[0]?.id ?? ""),
        }),
        sources,
        subjects: content.characters.map((c) => personOf(content, c.id)),
      };
    }
    case "claim": {
      const claim = state.claims[step.index];
      if (!claim) throw new Error(`Unknown claim ${String(step.index)}.`);
      return {
        kind: "claim",
        title: sayPeople(content.ui.claimTitle, {
          "{source}": calledBy(content, claim.source),
        }),
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
        body: fillParts(state, content, move.body),
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

function statusLabel(content: Content, id: string): string {
  return content.project.statuses.find((s) => s.id === id)?.label ?? id;
}

function toProjectView(state: State, content: Content): PlayerView["project"] {
  const { name, owner } = content.project;
  const { real, reported, news } = state.project;
  return {
    name,
    owner,
    real: statusLabel(content, real),
    reported: statusLabel(content, reported),
    news,
  };
}

function toView(state: State, world: World): PlayerView {
  const { content } = world;
  const left = remaining(state, content);
  const actionsLabel = countActions(content, left);
  return structuredClone({
    notebook: {
      clues: state.clues.map(({ month, source, text }) => ({
        month,
        source,
        text,
      })),
      marks: content.characters.map((c) => ({
        ...personOf(content, c.id),
        mark: state.marks.get(c.id) ?? null,
      })),
    },
    project: toProjectView(state, content),
    openDemands: state.openDemands.flatMap(({ id, month }) => {
      const item = content.demands?.items.find((d) => d.id === id);
      return item ? [{ month, subject: item.subject }] : [];
    }),
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
