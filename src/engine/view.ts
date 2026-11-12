import type { Kind } from "./content";

/** Everything the player can do. The view lists which of these are legal now. */
export type Choice =
  | { type: "continue" }
  | { type: "action"; actionId: string }
  | { type: "notification"; notificationId: string; optionId: string }
  | { type: "scene"; sceneId: string; optionId: string }
  | { type: "find-out"; sourceId: string; subjectId: string }
  | { type: "escape"; billId: string; escapeId: string };

/** A vacancy decided: Official standing, beside who really decided and why. */
export interface DecidedNotice {
  onPaper: { label: string; at: number; band: string; text: string } | null;
  inFact: string;
}

export interface Hotspot {
  id: string;
  label: string;
  description: string;
  place: string;
  costLabel: string;
  state: "available" | "done" | "unavailable";
}

export interface Buzzword {
  id: string;
  term: string;
  meaning: string;
}

export interface NotificationOption {
  id: string;
  label: string;
  costLabel: string;
  affordable: boolean;
  /** What is at stake, if this could end things on the spot. */
  stakes?: string | undefined;
}

export interface DialogLine {
  speaker?: string | undefined;
  text: string;
}

/** One person in a hierarchy, and the name of the person above them. */
export interface ChartEntry {
  name: string;
  title: string;
  reportsTo: string | null;
}

/**
 * One thing told of the month in the official story: what was reported
 * upstairs, beside what actually happened. Either side may be missing, for a
 * report with nothing behind it or a thing nobody reported.
 */
export interface StoryPair {
  reported?: string | undefined;
  happened?: string | undefined;
}

/** A sign in a Scene: its question, and what was seen. */
export interface SceneSign {
  label: string;
  text: string;
}

/** Everything seen of one Character in a Scene, led by their role. */
export interface ScenePerson {
  name: string;
  title: string;
  /** Whether they are the player's boss, or the boss's boss. */
  place: "boss" | "head" | null;
  /** What they were seen doing, from How people behave, if anything. */
  behaviour: string | null;
  /**
   * How they are with the player: the bosses' treatment, or anyone else's
   * regard. Signs, and no more. A plain one, such as a nod hello, says nothing
   * of note, so it is left out.
   */
  withYou: string | null;
  /** The signs from What you notice that name them and nobody else. */
  signs: SceneSign[];
}

export interface Person {
  id: string;
  name: string;
  title: string;
}

/** A short text dialog an answer led to, and the Buzzwords it taught. */
export interface DialogView {
  kind: "dialog";
  title: string;
  lines: DialogLine[];
  learned: Buzzword[];
  /** How the boss took it. Signs only: it never says the boss's kind. */
  reaction?: string | undefined;
}

export type StepView =
  | {
      kind: "notification";
      id: string;
      from: string;
      subject: string;
      body: string;
      options: NotificationOption[];
      /** How many more Notifications are waiting after this one. */
      waiting: number;
    }
  | { kind: "actions" }
  | {
      kind: "scene";
      id: string;
      title: string;
      location: string;
      narration: string[];
      /** One row to each Character present: the bosses, then the Org Chart's order. */
      people: ScenePerson[];
      /** The signs that name two people or more, or nobody in the room. */
      signs: SceneSign[];
      options: { id: string; label: string; stakes?: string | undefined }[];
    }
  | {
      kind: "find-out";
      title: string;
      prompt: string;
      sources: Person[];
      subjects: Person[];
    }
  | {
      kind: "notice";
      title: string;
      body: string;
      /** How the boss took it. Signs only: it never says the boss's kind. */
      reaction?: string | undefined;
      /** What the boss finally says of the player. */
      verdict?: string | undefined;
      decided?: DecidedNotice | undefined;
    }
  | { kind: "move"; from: string; title: string; body: string }
  /** A consequence of the player's own doing lands, and these are the ways out. */
  | {
      kind: "escape";
      id: string;
      from: string;
      title: string;
      body: string;
      /** A locked one `needs` more of a Gauge before it can be chosen. */
      escapes: {
        id: string;
        label: string;
        needs?: { label: string; at: number } | undefined;
      }[];
    }
  | { kind: "event"; from: string; title: string; body: string }
  | {
      kind: "story";
      title: string;
      reportedHeading?: string | undefined;
      happenedHeading?: string | undefined;
      /** Each thing told of the month, in the month's order. */
      pairs: StoryPair[];
      /** What moved a Gauge as the month closed. */
      gauges: string[];
    }
  /** The comic stand-in for winning, before the results screen. */
  | { kind: "win"; title: string; lines: string[] }
  | {
      kind: "results";
      title: string;
      intro: string;
      /** How the run ended. */
      ending: { fired: boolean; won: boolean; text: string | null };
      /** The route up: each seat the player won, and each time they came down. */
      route: { month: number; text: string }[];
      /** Official standing at the end, beside who really decides. */
      standing: {
        label: string;
        at: number;
        band: string;
        onPaper: string;
        decides: string;
        /** What the one who really decides ended up believing of the player. */
        believes: string | null;
      } | null;
      /** Each vacancy decided: on paper, and who really decided it and why. */
      vacancies: {
        month: number;
        text: string;
        /** Official standing's band then, if there is Official standing. */
        onPaper: string | null;
        inFact: string;
      }[];
      /** Each Thread that played out, traced back to what started it. */
      threads: {
        startedIn: number;
        started: string;
        playedIn: number;
        playedOut: string;
      }[];
      /** What each Character ended up believing, and how it reached them. */
      beliefs: {
        name: string;
        title: string;
        believes: string;
        reached: { month: number; text: string; how: string }[];
      }[];
      /** What moved the charts during the run. */
      changes: { month: number; title: string; changed: string }[];
      /** Each Escape tried: whether it worked, and why. */
      escapes: {
        month: number;
        title: string;
        label: string;
        kind: string;
        worked: boolean;
        why: string[];
      }[];
      /** What was building up, including what never came out. */
      risks: {
        addedIn: number;
        note: string;
        motive: string;
        cameOutIn: number | null;
        fate: string;
      }[];
      /** The player's word, what became of it, and who came to hear. */
      promises: {
        month: number;
        to: string;
        what: string;
        status: string;
        heardBy: string[];
      }[];
      /** What each Deal was really worth, and who owed whom on the Power Map. */
      deals: {
        month: number;
        with: string;
        what: string;
        status: string;
        worth: string;
      }[];
      favours: string[];
      /** Who changed, from what, into what, and what was done to them. */
      changed: {
        month: number;
        name: string;
        title: string;
        from: string;
        to: string;
        why: string[];
      }[];
      /** Each Rival, what they competed for, and what they did to the player. */
      rivals: {
        name: string;
        title: string;
        since: number;
        competed: string[];
        did: { month: number; text: string; family: string | null }[];
        /** What is said of a Rival who did nothing the player would notice. */
        didNothing: string | null;
      }[];
      /** Each boss's Grand Plan, and what really became of it. */
      grandPlans: {
        month: number;
        name: string;
        title: string;
        plan: string;
        fate: string;
        /** Who really had what it needed, if it needed anything. */
        keeper: string | null;
      }[];
      /** The Milestones earned, for comparing with friends. */
      milestones: { month: number; title: string }[];
      /** The big mistakes the player made, in order. */
      mistakes: { month: number; choice: string }[];
      characters: {
        name: string;
        title: string;
        kind: string;
        fact: string | null;
      }[];
      powerMap: ChartEntry[];
      marks: {
        name: string;
        title: string;
        mark: string | null;
        truth: string;
        correct: boolean;
      }[];
      /**
       * Every sign and claim, false or misleading first. The same thing told
       * again is one row, with how many times and in which months.
       */
      clues: {
        months: number[];
        count: number;
        source: string;
        text: string;
        verdict: string;
      }[];
      /** How many things the player was told, and how many were false or misleading. */
      told: { count: number; wrong: number };
      /** Where a Hidden Fact changed what happened in this run. */
      factEvents: { month: number; note: string; fact: string | null }[];
      /** Your boss's true kind, and how each choice came across to them. */
      boss: {
        name: string;
        title: string;
        kind: string;
        verdict: string | null;
        choices: { month: number; choice: string; landed: string }[];
        /** Your boss's boss's true kind, and what they really made of you. */
        head: {
          name: string;
          title: string;
          kind: string;
          verdict: string;
        } | null;
      };
      /** How the player played, by family of Move. */
      played: { family: string; note: string; count: number }[];
      claims: {
        month: number;
        source: string;
        text: string;
        verdict: string;
        note: string;
        motive: string;
      }[];
    };

/**
 * What the player's own last choice led to, shown beside whatever comes next
 * until they choose again.
 */
export type ResultView =
  /** What happened at a place on the floor, or in a Scene. */
  | {
      kind: "happened";
      title: string;
      body: string;
      /** How the boss took it. Signs only: it never says the boss's kind. */
      reaction?: string | undefined;
      /** What the boss finally says of the player. */
      verdict?: string | undefined;
      /** The place on the floor spent on it, if one was. */
      spent: string | null;
    }
  /** A claim heard at Find Out, which nothing says is true. */
  | { kind: "claim"; title: string; text: string; spent: string | null }
  /** A Notification answered: the e-mail, the answer and what it led to. */
  | {
      kind: "answer";
      from: string;
      subject: string;
      body: string;
      answer: string;
      then: Extract<StepView, { kind: "notice" }> | DialogView;
    };

/** Only what the player is entitled to see. It never holds undiscovered truth. */
export interface PlayerView {
  notebook: {
    /** Never says which of these can be trusted, until the results screen. */
    /** `about` names whom a clue concerns. Never whether it can be trusted. */
    clues: { month: number; source: string; text: string; about: string[] }[];
    marks: (Person & { mark: Kind | null })[];
    /** How many of the latest clues came since the Notebook was last opened. */
    unread: number;
  };
  /** The player's own Project, which can be looked at any time for nothing. */
  project: {
    name: string;
    owner: string;
    real: string;
    reported: string;
    realColour: string;
    reportedColour: string;
    news: { month: number; text: string }[];
  };
  /** The boss's Grand Plan, once the player has heard of it, and where it has got to. */
  grandPlan: { title: string; what: string; status: string } | null;
  /** Demands the player stalled and has not yet heard the last of. */
  openDemands: { month: number; subject: string }[];
  /** Everything the player has given their word on, and where it has got to. */
  promises: { month: number; to: string; what: string; status: string }[];
  /** The Deals the player has made, and the favours they are party to. No others. */
  deals: { month: number; with: string; what: string; status: string }[];
  favours: string[];
  /** The player's Gauges, which say nothing of the Power Map or real danger. */
  gauges: {
    id: string;
    label: string;
    value: number;
    /** Each Thread that moved it. */
    moves: { month: number; by: number; note: string }[];
  }[];
  milestones: { month: number; title: string }[];
  /**
   * How the player would fare on paper if a vacancy arose, shown as a bar with
   * no number. It reads only the official record, never the Power Map.
   */
  standing: {
    label: string;
    title: string;
    /** How far along the bar, from 0 to 1. */
    at: number;
    band: string;
  } | null;
  /** Whether one more big mistake gets the player fired. */
  finalWarning: boolean;
  /** The player's job, whose id keys the floor the tower draws. */
  job: { id: string; title: string };
  seed: number;
  month: number;
  totalMonths: number;
  actions: { total: number; spent: number; remaining: number; label: string };
  buzzwords: Buzzword[];
  orgChart: ChartEntry[];
  hotspots: Hotspot[];
  step: StepView;
  result: ResultView | null;
  hint: string;
  choices: Choice[];
}
