import type { Claim } from "./claims";
import type {
  ClueVerdict,
  Content,
  Kind,
  MoveFamily,
  SceneData,
} from "./content";
import type { DealtCharacter, PowerMap } from "./deal";

export class IllegalChoiceError extends Error {
  override name = "IllegalChoiceError";
}

export interface HiddenTruth {
  characters: DealtCharacter[];
  powerMap: PowerMap;
  /** Moved by the player's choices. Shown only through how the boss behaves. */
  bossOpinion: number;
  /** The same of the boss's boss, whom the player can also try to impress. */
  headOpinion: number;
}

/** Custom behaviour for a Scene: reshapes its data for the current truth. */
export type SceneScript = (
  scene: SceneData,
  context: { powerMap: PowerMap },
) => SceneData;

export type SceneScripts = Readonly<Record<string, SceneScript>>;

export interface World {
  content: Content;
  sceneScripts: SceneScripts;
}

/** Which behaviour a Character was seen showing when a Scene opened. */
export interface ShownBehaviour {
  character: string;
  behaviour: string;
}

export type Step =
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
      headTreatment: string | null;
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
export interface MonthRecord {
  noted: string[];
  spent: number;
  visited: string[];
  unanswered: string[];
  flags: string[];
  moveLanded: boolean;
  /** Whether the month has dealt with the player missing its meeting. */
  absenceDealtWith: boolean;
}

/**
 * What belongs to the run, and carries from month to month. All of it is plain
 * data, so that saving a run needs nothing written for any one mechanic.
 */
export interface State extends MonthRecord {
  seed: number;
  rng: number;
  month: number;
  buzzwords: string[];
  claims: Claim[];
  /** So that a Move does not land twice in a run while others remain. */
  movesLanded: string[];
  clues: Clue[];
  /** Who the player suspects of what. Nothing in the rules ever reads this. */
  marks: Record<string, Kind>;
  /** Who the player was last told has each Hidden Fact, true or not. */
  heard: { fact: string; subject: string }[];
  factEvents: { month: number; note: string; fact: string | null }[];
  bossLandings: BossLanding[];
  /** How often each approach has been used, since some can be overdone. */
  approachUses: Record<string, number>;
  verdict: string | null;
  /** Demands the player stalled, which stay open until forgotten or answered. */
  openDemands: {
    id: string;
    month: number;
    chased: boolean;
    /** Given at a missed meeting, and yet to arrive as a Notification. */
    due?: boolean;
  }[];
  /** How many Moves of each family the player has made. Never shown in play. */
  played: Partial<Record<MoveFamily, number>>;
  /** How often the player has gone over the boss's head. */
  overHeadUses: number;
  /** The missed meetings' actions given so far, each of them once in a run. */
  actionsGiven: string[];
  /** What the player is told before anything else, as a month opens. */
  noticesDue: { title: string; body: string }[];
  project: {
    real: string;
    reported: string;
    news: ProjectNews[];
    /** Flagged, and not yet explained. */
    flagged: boolean;
  };
  /** Every flag ever set, which unlike `flags` lasts the whole run. */
  deeds: { flag: string; month: number }[];
  /** The Threads started so far. Nothing of these is shown until one plays out. */
  threads: {
    id: string;
    month: number;
    /** The month it comes back in. Null if it never will. */
    due: number | null;
    played: { month: number; text: string } | null;
  }[];
  /** Bills waiting to land this month as Character Moves. */
  billsDue: string[];
  /** Told to the player, and shown from then on. */
  finalWarning: boolean;
  /** The month the player was fired in, which ends the run. */
  firedIn: number | null;
  /** The big mistakes so far, for the results screen. */
  mistakes: { month: number; choice: string }[];
  step: Step;
  truth: HiddenTruth;
}
