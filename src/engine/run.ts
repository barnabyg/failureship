import { applyChoice } from "./choices";
import { KINDS, type Content, type Kind } from "./content";
import { dealCharacters, dealMotives, dealPowerMap } from "./deal";
import { freshMonth, nextStep, openMonth } from "./month";
import { noteEvents } from "./notebook";
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
      if (kind === null) state.marks.delete(character);
      else state.marks.set(character, kind);
      return view();
    },
  };
  truths.set(run, () => structuredClone(state.truth));
  return run;
}
