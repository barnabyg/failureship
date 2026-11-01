import type { Claim } from "./claims";
import type {
  ClueVerdict,
  Content,
  Kind,
  MoveFamily,
  SceneData,
  Tone,
} from "./content";
import type { DealtCharacter, PowerMap } from "./deal";

export class IllegalChoiceError extends Error {
  override name = "IllegalChoiceError";
}

/** What has reached one Character, and how. */
export interface Memory {
  character: string;
  about: string;
  text: string;
  month: number;
  tone?: Tone | undefined;
  /** Who told them. Null if they were there. */
  via: string | null;
  /** How far it had come along the Power Map. */
  hops: number;
  /** Which piece of news it was, if it was any that can travel. */
  news: number | null;
}

export interface TruthOfRun {
  characters: DealtCharacter[];
  powerMap: PowerMap;
  /**
   * What each Character believes of the player, which is the one idea of what
   * someone thinks of you. Moved by what reaches them. Shown only through signs.
   */
  beliefs: Record<string, number>;
  /** Everything that can travel, from where it started. */
  news: { about: string; tone: Tone; text: string; month: number }[];
  /** What the player's decisions have built up. Never shown until the end. */
  risks: {
    id: string;
    month: number;
    due: number;
    /** When it came out, and whether it could be traced to the player. */
    cameOut: { month: number; onPlayer: boolean } | null;
  }[];
  /** What each Character has kept of what the player did. */
  memories: Memory[];
}

/** The true state of a run, as tests read it. */
export interface HiddenTruth extends TruthOfRun {
  /** What the boss believes of the player. */
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
      /** How anyone else present is with the player. */
      regard: { character: string; sign: string }[];
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
  | { kind: "event"; id: string }
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
  /** Who has been moved on the Org Chart, and who to. */
  reportsTo: Record<string, string>;
  /** Company Events waiting to land this month. */
  eventsDue: string[];
  eventsLanded: { id: string; month: number }[];
  /** Told to the player, and shown from then on. */
  finalWarning: boolean;
  /** The month the player was fired in, which ends the run. */
  firedIn: number | null;
  /** The big mistakes so far, for the results screen. */
  mistakes: { month: number; choice: string }[];
  step: Step;
  truth: TruthOfRun;
}
