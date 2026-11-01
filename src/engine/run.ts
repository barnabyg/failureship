import { applyChoice } from "./choices";
import { KINDS, type Content, type Kind } from "./content";
import { dealCharacters, dealMotives, dealPowerMap } from "./deal";
import { freshMonth, nextStep, openMonth } from "./month";
import { noteEvents } from "./notebook";
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
  const dealt = dealCharacters(seed, content);
  const power = dealPowerMap(dealt.next, content);
  const motives = dealMotives(power.next, dealt.characters, content);
  return {
    seed,
    rng: motives.next,
    month: 1,
    ...freshMonth(content, 1),
    buzzwords: [],
    claims: [],
    movesLanded: [],
    clues: [],
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
    finalWarning: false,
    firedIn: null,
    mistakes: [],
    step: { kind: "actions" },
    truth: {
      characters: motives.characters,
      powerMap: power.powerMap,
      bossOpinion: 0,
      headOpinion: 0,
      risks: [],
      memories: [],
    },
  };
}

export function startRun(options: {
  seed: number;
  content: Content;
  sceneScripts?: SceneScripts;
}): Run {
  const { seed, content, sceneScripts = {} } = options;
  const world: World = { content, sceneScripts };
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
}): Run {
  const { save, content, sceneScripts = {} } = options;
  const world: World = { content, sceneScripts };
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
    save: () => writeSave(state, content),
  };
  truths.set(run, () => structuredClone(state.truth));
  return run;
}
