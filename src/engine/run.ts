import { landWithBoss, treatBoss } from "./boss";
import { makeClaim, verdictOfClaim } from "./claims";
import {
  KINDS,
  behavioursOpenTo,
  chasedIdOf,
  everyNotification,
  type ClueVerdict,
  type Content,
  type Kind,
  type MoveFamily,
} from "./content";
import { dealCharacters, dealMotives, dealPowerMap } from "./deal";
import { dealWithAbsence, followUpDemands } from "./demands";
import { goOverHead, treatHead } from "./over-head";
import {
  actionsThisMonth,
  costOf,
  fillParts,
  fillSubject,
  heardAbout,
  inMonth,
  inTurn,
  isAvailable,
  matches,
  methodOf,
  moodOf,
  offeredOptions,
  remaining,
  sceneData,
} from "./reads";
import { draw, drawFor, pick, pickWeighted } from "./rng";
import { calledBy, capitalised, sayPeople } from "./say";
import type {
  HiddenTruth,
  MonthRecord,
  SceneScripts,
  ShownBehaviour,
  State,
  Step,
  World,
} from "./state";
import { legalChoices, toView } from "./to-view";
import type { Choice, PlayerView } from "./view";

export type { HiddenTruth, SceneScript } from "./state";

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
    played: {},
    overHeadUses: 0,
    actionsGiven: [],
    noticesDue: [],
    project: { ...content.project.start, news: [], flagged: false },
    step: { kind: "actions" },
    truth: {
      characters: motives.characters,
      powerMap: power.powerMap,
      bossOpinion: 0,
      headOpinion: 0,
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
    absenceDealtWith: false,
  };
}

/** What happens as a month opens, whatever the player has done. */
function openMonth(state: State, content: Content): void {
  followUpDemands(state, content);
  const { input } = content.project;
  const colleague = state.truth.characters.find(
    (c) => c.id === input?.character,
  );
  if (input && colleague && inMonth(input, state.month)) {
    const value = drawFor(state.seed, "report-input", state.month);
    if (value < input.chance[colleague.kind]) state.flags.push(input.sets);
  }
  for (const event of content.project.events) {
    if (inMonth(event, state.month)) {
      moveProject(state, content, event.project);
      state.project.news.push({ month: state.month, text: event.text });
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
  // What the boss thinks is mostly about lately, so it stays worth reading.
  state.truth.bossOpinion = Math.trunc(
    state.truth.bossOpinion * world.content.balance.opinion.keeps,
  );
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
      countMove(state, action.family);
      const reaction = applyOutcome(state, content, action, action.label);
      if (action.scene !== undefined) {
        state.step = openScene(state, world, action.scene);
      } else if (action.findOut !== undefined) {
        state.step = arriveToFindOut(state, content, action.findOut);
      } else if (action.overHead) {
        state.step = goOverHead(state, content, action.label);
      } else if (action.result) {
        const results = [action.result, ...action.moreResults];
        const result = inTurn(results, state.month);
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

function countMove(state: State, family: MoveFamily | undefined): void {
  if (family) state.played[family] = (state.played[family] ?? 0) + 1;
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
  state.openDemands = state.openDemands.filter(
    (d) =>
      d.id !== choice.notificationId &&
      chasedIdOf(d.id) !== choice.notificationId,
  );
  if (option.stalls) {
    state.openDemands.push({
      id: choice.notificationId,
      month: state.month,
      chased: false,
    });
  }

  countMove(state, option.family);
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
  const reaction = applyOutcome(state, content, outcome, option.label);

  if (option.dialog !== undefined) {
    state.step = { kind: "dialog", id: option.dialog, learned, reaction };
  } else if (outcome.result) {
    state.step = { kind: "notice", ...outcome.result, reaction };
  } else {
    state.step = nextStep(state, world);
  }
}

/** What any choice does: sets its flags, moves the Project, lands with the boss. */
function applyOutcome(
  state: State,
  content: Content,
  outcome: Parameters<typeof landWithBoss>[2] & {
    sets: readonly string[];
    headOpinion?: number;
    project?: Parameters<typeof moveProject>[2];
  },
  label: string,
): string | undefined {
  state.flags.push(...outcome.sets);
  state.truth.headOpinion += outcome.headOpinion ?? 0;
  moveProject(state, content, outcome.project);
  return landWithBoss(state, content, outcome, label);
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
    headTreatment: treatHead(state, content, cast),
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
  countMove(state, option?.family);
  const heard = heardAbout(state, option?.about);
  const fill = (written: string) =>
    fillSubject(
      state,
      world.content,
      option?.about,
      fillParts(state, world.content, written, scene.cast),
    );
  const reaction = applyOutcome(
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
  const flag = content.project.flagged;
  if (flag && state.project.flagged) {
    state.project.flagged = false;
    state.spent = Math.min(
      content.balance.actionsPerMonth,
      state.spent + costOf(content, flag.cost),
    );
    return openScene(state, world, flag.scene);
  }
  if (
    actionsThisMonth(state, content).some((a) => isAvailable(state, content, a))
  ) {
    return { kind: "actions" };
  }
  return (
    dealWithAbsence(state, content) ??
    landMove(state, content) ?? { kind: "story" }
  );
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
