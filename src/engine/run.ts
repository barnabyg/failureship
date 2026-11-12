import { applyChoice } from "./choices";
import { KINDS, type Content, type Kind } from "./content";
import {
  dealCharacters,
  dealFavours,
  dealMotives,
  dealNewcomers,
  dealPowerMap,
} from "./deal";
import { freshMonth, nextStep, openMonth } from "./month";
import { startingGauges } from "./gauges";
import { noteEvents } from "./notebook";
import { bossOf, headOf } from "./places";
import { beliefOf } from "./reads";
import { readSave, UnusableSaveError, writeSave } from "./save";
import {
  IllegalChoiceError,
  type HiddenTruth,
  type SceneScripts,
  type State,
  type World,
} from "./state";
import { legalChoices, toView } from "./to-view";
import type { Choice, PlayerView } from "./view";

export type { HiddenTruth, SceneScript } from "./state";
export { IllegalChoiceError };

/** A run in play. The interface only ever sees its player view. */
export interface Run {
  view(): PlayerView;
  /** Applies a legal choice and returns the new view. Throws on any other. */
  choose(choice: Choice): PlayerView;
  /** Sets or clears a suspicion, at no cost. Throws once the run has ended. */
  mark(character: string, kind: Kind | null): PlayerView;
  /** The Notebook has been opened, so that none of its clues are new. */
  readNotebook(): PlayerView;
  /** The whole run, as text that `resumeRun` can carry on from. */
  save(): string;
}

const truths = new WeakMap<Run, () => HiddenTruth>();

/** Reads the true state of a run. Exposed through `./hidden-truth` only. */
export function hiddenTruthOf(run: Run): HiddenTruth {
  const read = truths.get(run);
  if (!read) throw new Error("Not a run started by this engine.");
  return read();
}

function checkScripts({ content, sceneScripts }: World): void {
  for (const scene of content.scenes) {
    if (scene.script !== undefined && !(scene.script in sceneScripts)) {
      throw new Error(
        `Scene "${scene.id}" needs missing script "${scene.script}".`,
      );
    }
  }
}

/** A deal with nothing yet done in it, before its first month opens. */
function dealtState(seed: number, content: Content): State {
  const { job } = content.you;
  const where = { seed, job, monthsOnFloor: { [job]: 1 } };
  const dealt = dealCharacters(seed, content);
  const power = dealPowerMap(dealt.next, content);
  const motives = dealMotives(power.next, dealt.characters, content);
  const later = dealNewcomers(
    seed,
    motives.characters,
    dealFavours(seed, power.powerMap, content),
    content,
  );
  return {
    ...where,
    rng: motives.next,
    month: 1,
    ...freshMonth(where, content),
    buzzwords: [],
    claims: [],
    movesLanded: [],
    clues: [],
    cluesRead: 0,
    marks: {},
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
    deeds: [],
    threads: [],
    billsDue: [],
    escapesDue: [],
    escapes: [],
    reportsTo: {},
    eventsDue: [],
    eventsLanded: [],
    promises: [],
    deals: [],
    plans: [],
    vacancies: [],
    gone: [],
    titles: {},
    ...startingGauges(content),
    finalWarning: false,
    firedIn: null,
    wonIn: null,
    demotions: [],
    mistakes: [],
    step: { kind: "actions" },
    result: null,
    truth: {
      characters: later.characters,
      powerMap: later.powerMap,
      beliefs: {},
      news: [],
      risks: [],
      memories: [],
      changes: [],
      rivals: [],
    },
  };
}

export function startRun(options: {
  seed: number;
  content: Content;
  sceneScripts?: SceneScripts;
  /** Ends the run as this month closes, as World's `endsAfter` says. */
  endsAfter?: number | undefined;
}): Run {
  const { seed, content, sceneScripts = {}, endsAfter } = options;
  const world: World = { content, sceneScripts, endsAfter };
  checkScripts(world);
  const state = dealtState(seed, content);
  openMonth(state, content);
  state.step = nextStep(state, world);
  return runOf(state, world);
}

/**
 * Carries on from `Run.save`, exactly as the run would have gone. Throws
 * `UnusableSaveError` if the save is old, broken or does not fit the content.
 */
export function resumeRun(options: {
  save: string;
  content: Content;
  sceneScripts?: SceneScripts;
  endsAfter?: number | undefined;
}): Run {
  const { save, content, sceneScripts = {}, endsAfter } = options;
  const world: World = { content, sceneScripts, endsAfter };
  checkScripts(world);
  const state = readSave(save, content, dealtState(0, content));
  const run = runOf(state, world);
  try {
    run.view();
  } catch (cause) {
    throw new UnusableSaveError("A save names what is not there.", { cause });
  }
  return run;
}

function runOf(state: State, world: World): Run {
  const { content } = world;
  const view = () => toView(state, world);
  const run: Run = {
    view,
    choose(choice) {
      const legal = legalChoices(state, world);
      const wanted = JSON.stringify(choice);
      if (!legal.some((c) => JSON.stringify(c) === wanted)) {
        throw new IllegalChoiceError(`Choice not available now: ${wanted}`);
      }
      applyChoice(state, world, choice);
      noteEvents(state, content);
      return view();
    },
    mark(character, kind) {
      const known = content.characters.some((c) => c.id === character);
      const legal = kind === null || KINDS.includes(kind);
      if (state.step.kind === "results" || !known || !legal) {
        throw new IllegalChoiceError(`Cannot mark ${character}.`);
      }
      state.marks = Object.fromEntries(
        Object.entries({ ...state.marks, [character]: kind }).filter(
          (entry): entry is [string, Kind] => entry[1] !== null,
        ),
      );
      return view();
    },
    readNotebook() {
      state.cluesRead = state.clues.length;
      return view();
    },
    save: () => writeSave(state, content),
  };
  truths.set(run, () => ({
    ...structuredClone(state.truth),
    bossBelief: beliefOf(state, bossOf(state, content)),
    headBelief: beliefOf(state, headOf(state, content) ?? ""),
    plans: structuredClone(state.plans),
    vacancies: structuredClone(state.vacancies),
  }));
  return run;
}
