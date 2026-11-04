import type { Claim } from "./claims";
import type {
  ClueVerdict,
  Content,
  Kind,
  MoveFamily,
  PlanHow,
  SceneData,
  SeatWay,
  Tone,
  VacancyReason,
} from "./content";
import type { DealtCharacter, PowerMap } from "./deal";
import type { DecidedNotice } from "./view";

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
  /** The month they found out that it was a false story, if they did. */
  foundOut: number | null;
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
  news: {
    about: string;
    tone: Tone;
    text: string;
    month: number;
    /** If it is about a broken word: whose, and what was offered. */
    word?: { victim: string; what: string } | undefined;
    /** Who made it up, if it is a false story: a Character, or the player. */
    startedBy?: string | undefined;
    /** Whom a false story is about. Left out, the player. */
    of?: string | undefined;
    /** What is said of the player once a story they made up is seen through. */
    exposed?: { about: string; text: string } | undefined;
    /** Whom the deed was done to, who alone is burned by it at first hand. */
    victim?: string | undefined;
  }[];
  /** What the player's decisions have built up. Never shown until the end. */
  risks: {
    id: string;
    month: number;
    due: number;
    /** When it came out, and whether it could be traced to the player. */
    cameOut: {
      month: number;
      onPlayer: boolean;
      /** The whistleblower it came out through, if it was one. */
      through?: string | undefined;
    } | null;
  }[];
  /** What each Character has kept of what the player did. */
  memories: Memory[];
  /** Believers who were burned enough to change. Never shown until the end. */
  changes: Change[];
  /** Everyone who has been the player's Rival. Never shown until the end. */
  rivals: Rivalry[];
}

/** A Rival: since when, for what, and the Moves they made against the player. */
export interface Rivalry {
  character: string;
  since: number;
  /** What they competed for, by the ids in `competing`. */
  for: string[];
  did: { month: number; move: string }[];
}

/** A Believer who changed: what into, when and why. */
export interface Change {
  character: string;
  month: number;
  from: Kind;
  to: "practitioner" | "whistleblower" | "left";
  why: string[];
  /** Whether a whistleblower has acted on what they know. */
  acted: boolean;
}

/** The true state of a run, as tests read it. */
export interface HiddenTruth extends TruthOfRun {
  /** The boss's belief about the player. */
  bossBelief: number;
  /** The same of the boss's boss, whom the player can also try to impress. */
  headBelief: number;
  /** Each boss's Grand Plans, with who really had what each needed. */
  plans: TakenPlan[];
  /** Each vacancy, with who really decided it and why. */
  vacancies: Vacancy[];
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
      /** Shown as written, even naming someone who has gone. */
      asWritten?: boolean | undefined;
      /** A vacancy decided: Official standing beside who really decided. */
      decided?: DecidedNotice | undefined;
    }
  | {
      kind: "move";
      id: string;
      /** Who made it, if anyone in particular did. */
      by?: string | undefined;
    }
  | { kind: "event"; id: string }
  | { kind: "story" }
  /** The comic stand-in for winning, told once, after the seat that won it. */
  | { kind: "win" }
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
  /** Whoever was the player's boss then. */
  boss: string;
  choice: string;
  shift: number;
}

/** A Grand Plan a boss took on, and what became of it. */
export interface TakenPlan {
  id: string;
  /** Whose it is: whoever was the player's boss when they took it on. */
  boss: string;
  month: number;
  /** The last month of the run it can be completed in. */
  due: number;
  /** The month the player heard of it. Null until they do. */
  heard: number | null;
  /** Who really has what it needs, dealt as it is taken on. Never shown until the end. */
  keeper: string | null;
  /** How it ended, by which of its ways, and whether its boss counted it done. */
  ended: {
    month: number;
    /** Dropped if its boss left before it was done. */
    how: PlanHow | "failed" | "dropped";
    way: string | null;
    counted: boolean;
  } | null;
}

/** One candidate for a vacancy: the player is `YOU`, and why they weighed what they did. */
export interface Candidate {
  who: string;
  /** The reasons that counted for them, by their keys in `vacancies.json`. */
  reasons: VacancyReason[];
  strength: number;
}

/** A seat that fell vacant, how it did, and how it was decided. */
export interface Vacancy {
  seat: string;
  /**
   * Whoever held it: moving up, gone, or, for a post created out of their team,
   * staying where they are.
   */
  holder: string;
  /** How it fell vacant. */
  way: SeatWay;
  /**
   * Whoever held influence over the holder on the Power Map as it fell vacant,
   * who decides a seat whose holder has left, and so is off the map.
   */
  patron: string | null;
  /** The first month it is open. */
  opened: number;
  /** The month at whose close it is decided. */
  decides: number;
  /** Whoever has claimed the credit for the Plan that opened it, last. */
  credit: string | null;
  /** Whoever has called in a favour from whoever decides. */
  calledIn: string[];
  decided: {
    month: number;
    /** Whoever really held influence over it on the Power Map. */
    decider: string;
    /** Their kind then, which is how each reason weighed with them. */
    kind: Kind;
    /** Who got it: a Character, or `YOU`. */
    winner: string;
    /** Whether it was too close to call, and went by a draw among the best. */
    close: boolean;
    /** Whether a big mistake while it was open cost the player a seat they would otherwise have had. */
    blocked: boolean;
    candidates: Candidate[];
    /** Official standing's band then, by its label: what the paperwork said. */
    onPaper: string | null;
    /** The seat's job title as its holder held it, which whoever takes it holds. */
    held: { title: string; called: string };
  } | null;
}

/** Where a commitment has got to. A refused one was never taken up. */
export type CommitmentStatus =
  "open" | "kept" | "broken" | "refused" | "lapsed";

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
  /** Whether the month's quarterly review, if it has one, has been held. */
  reviewed: boolean;
  /** Whether the month has closed: the last month's, once its story is told. */
  closed: boolean;
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
  noticesDue: {
    title: string;
    body: string;
    asWritten?: boolean;
    /** How the boss took it. Signs only: it never says the boss's kind. */
    reaction?: string | undefined;
    decided?: DecidedNotice | undefined;
  }[];
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
  /** Who has been moved on the Org Chart, the player included, and who to. */
  reportsTo: Record<string, string>;
  /** The player's job now, which decides the floor they are on. */
  job: string;
  /** How many months the player has spent on each floor, by job, this one included. */
  monthsOnFloor: Record<string, number>;
  /** Company Events waiting to land this month. */
  eventsDue: string[];
  eventsLanded: { id: string; month: number }[];
  /** Everything the player has given their word on, in plain view. */
  promises: {
    id: string;
    /** Whom it was made to: whoever was in the place written, if it names one. */
    to: string;
    month: number;
    status: CommitmentStatus;
    /** The month it falls due. Null if it never will. */
    due: number | null;
    /** What was said back. */
    reply: string;
    /** The news of how it ended, if there was any. */
    news: number | null;
  }[];
  /** The Deals the player has made, each side of which can fail. */
  deals: {
    id: string;
    month: number;
    /** Their side: whether they gave the word, and what it was really worth. */
    word: "pending" | "landed" | "worthless" | "withheld";
    wordDue: number;
    status: CommitmentStatus;
    due: number;
    news: number | null;
  }[];
  /** The Grand Plan each of the player's bosses took on, one each, in order. */
  plans: TakenPlan[];
  /** Every seat that has fallen vacant, and who really decided it. Never shown until decided. */
  vacancies: Vacancy[];
  /** Everyone who has left the company, for the rest of the run, and how. */
  gone: { character: string; month: number; how: "left" | "fired" }[];
  /** Job titles taken by moving up, which stand in for those written. */
  titles: Record<string, { title: string; called: string }>;
  /** Each Gauge's value. Only Milestones read these. */
  gauges: Record<string, number>;
  /** What moved each Gauge, for the player to see. */
  gaugeMoves: { month: number; gauge: string; by: number; note: string }[];
  /** Moves from Threads played out this month, waiting for it to close. */
  gaugesDue: { gauge: string; by: number; note: string }[];
  milestones: { gauge: string; at: number; month: number }[];
  /** Told to the player, and shown from then on. */
  finalWarning: boolean;
  /** The month the player was fired in, which ends the run. */
  firedIn: number | null;
  /** The month the player won the way out of the top floor, which ends the run. */
  wonIn: number | null;
  /** Each time a big mistake took the player back down, and to which job. */
  demotions: { month: number; job: string }[];
  /** The big mistakes so far, for the results screen. */
  mistakes: { month: number; choice: string }[];
  step: Step;
  truth: TruthOfRun;
}
