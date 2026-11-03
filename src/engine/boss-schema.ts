import { z } from "zod";
import {
  KINDS,
  condition,
  floor,
  id,
  lines,
  notice,
  perKind,
  text,
} from "./basic-schema";
import { bill } from "./consequence-schema";
import { notificationOption, sets, TONES } from "./outcome-schema";
import { notification } from "./step-schema";

/** A way of coming across, and how each kind of boss takes it. */
const bossApproach = z.strictObject({
  id,
  shift: perKind(z.number().int()),
  /** How each kind shows it, used in turn so that it reads differently each month. */
  reaction: perKind(lines),
  /** Past this many uses in a run, these kinds take it differently. */
  overdone: z
    .strictObject({
      after: z.number().int().positive(),
      shift: perKind(z.number().int()).partial(),
      reaction: perKind(lines).partial(),
    })
    .optional(),
});

const bossSign = z.strictObject({
  id,
  text,
  /** How likely each mood is to show this, relative to its other signs. */
  likelihood: z.strictObject({
    warm: z.number().nonnegative(),
    neutral: z.number().nonnegative(),
    cold: z.number().nonnegative(),
  }),
});

/** Whoever is the player's boss, as the Org Chart has it. */
export const boss = z.strictObject({
  signs: z.array(bossSign),
  approaches: z.array(bossApproach).default([]),
});

/**
 * Going over the boss's head, to the boss's boss as the Org Chart has it: what it
 * can do, and who can find out.
 */
export const overHead = z.strictObject({
  /** How they treat the player in a Scene, by their mood. */
  signs: z.array(bossSign),
  /** The belief at which their mood changes. It moves less often than the boss's. */
  mood: z.strictObject({
    warmAt: z.number().int().positive(),
    coldAt: z.number().int().negative(),
  }),
  /** How it goes, by the kind of the person gone to. */
  outcomes: perKind(
    z.strictObject({
      /** The seeded chance of it working, by their place on the Power Map. */
      works: z.strictObject({
        influential: z.number().min(0).max(1),
        sidelined: z.number().min(0).max(1),
      }),
      worked: z.strictObject({ influential: lines, sidelined: lines }),
      failed: lines,
    }),
  ),
  /** How far each belief moves. The boss gains only by what they can make stick. */
  effects: z.strictObject({
    worked: z.strictObject({
      head: z.number().int().positive(),
      boss: z.strictObject({
        influential: z.number().int().positive(),
        sidelined: z.number().int().nonnegative(),
      }),
    }),
    failed: z.strictObject({
      head: z.number().int().negative(),
      boss: z.number().int().nonpositive(),
    }),
  }),
  /** Whether the boss hears of it, which goes by the boss's own kind. */
  findsOut: z.strictObject({
    chance: perKind(z.number().min(0).max(1)),
    /** How much likelier each further trip makes it. */
    perUse: z.number().min(0).max(1),
    shift: z.number().int().negative(),
    title: text,
    reaction: perKind(lines),
  }),
  /** What the results screen says they made of the player. */
  verdict: z.strictObject({ warm: text, neutral: text, cold: text }),
  sets: z.strictObject({ went: id, caught: id }),
});

/** What Characters believe of the player, and how that reaches them. */
export const reputation = z.strictObject({
  /** How far and how fast news goes along the Power Map's ties. */
  travel: z.strictObject({
    hopsPerMonth: z.number().int().positive(),
    maxHops: z.number().int().nonnegative(),
    /** The seeded chance of each person passing it on to each person tied to them. */
    passOnChance: z.number().min(0).max(1),
    shift: z.strictObject({
      good: z.number().int().positive(),
      bad: z.number().int().negative(),
    }),
  }),
  /** The belief at which someone's mood, and so their signs, change. */
  mood: z.strictObject({
    warmAt: z.number().int().positive(),
    coldAt: z.number().int().negative(),
  }),
  /** How someone other than the bosses is with the player. Says {who}. */
  signs: z.array(bossSign).min(1),
  /** What the results screen says each ended up believing. */
  believes: z.strictObject({ warm: text, neutral: text, cold: text }),
  /** How something reached them. The second says {who}. */
  how: z.strictObject({ direct: text, heardFrom: text }),
  /** False stories about the player, which travel as news does. */
  falseStories: z
    .strictObject({
      /** The seeded chance, each month, that someone of each kind sees through one. */
      foundOut: perKind(z.number().min(0).max(1)),
      /** What the results screen says of whoever made it up. */
      started: text,
      /** What it says of someone who found out. Says {month}. */
      found: text,
    })
    .optional(),
});

const chasedDemand = z.strictObject({
  from: text,
  subject: text,
  body: text,
  options: z.array(notificationOption).min(1),
});

/** An instruction from above, which can be answered in the five ways below. */
const demand = notification.omit({ pool: true }).extend({
  /** What happens if the boss forgets a stalled Demand. */
  forgotten: notice,
  /** What arrives if the boss chases a stalled Demand instead. */
  chased: chasedDemand,
});

/** Instructions from above, and what comes of stalling them. */
export const demands = z.strictObject({
  /** Each month, how likely each kind of boss is to forget or to chase. */
  odds: perKind(
    z.strictObject({
      forgets: z.number().min(0).max(1),
      chases: z.number().min(0).max(1),
    }),
  ),
  /** What being chased costs with each kind, before any answer is given. */
  chasedPenalty: perKind(z.number().int().nonpositive()),
  /** Set for the month when a stalled Demand is forgotten or chased. */
  sets: z.strictObject({ forgotten: id, chased: id }),
  items: z.array(demand),
  /** What a meeting the player does not go to leaves them with. */
  missed: z
    .strictObject({
      /** The flag that going to this month's meeting sets. */
      attended: id,
      /** Set for the month when a meeting is missed. */
      sets,
      /** How each kind of boss takes the absence. */
      approach: id,
      /** The answers, the same for whichever action the minutes record. */
      options: z.array(notificationOption).min(1),
      forgotten: notice,
      chased: chasedDemand,
      /** What the minutes can give. Each is given once in a run. */
      actions: z
        .array(
          z.strictObject({
            id,
            /** What the player is told as the month closes. */
            title: text,
            body: text,
            /** How the Demand arrives the month after. */
            from: text,
            subject: text,
            ask: text,
          }),
        )
        .min(1),
    })
    .optional(),
});

export const DEMAND_ANSWERS = [
  "deliver",
  "push-back",
  "hand-off",
  "fake",
  "stall",
] as const;

export const PLAN_HOWS = ["reality", "appearance"] as const;
/** How a Grand Plan was completed: really done, or made to look done. */
export type PlanHow = (typeof PLAN_HOWS)[number];

/** One way of completing a Grand Plan, and how each kind of boss takes it. */
const planWay = z.strictObject({
  id,
  /** Really done, or made to look done. */
  how: z.enum(PLAN_HOWS),
  /**
   * What the player did that completes it this way. Never the hidden truth. Left
   * out, it is only ever another way's `otherwise`.
   */
  when: condition.optional(),
  /** Whether it needs what the Plan `needs`, from whoever really has it. */
  needs: z.boolean().default(false),
  /** The way it is completed instead, without what it needs. */
  otherwise: id.optional(),
  /** The kinds of boss who count it done. Others still see it on the record. */
  counts: z.array(z.enum(KINDS)).min(1),
  /** How far it moves the boss's belief, by their kind. */
  belief: perKind(z.number().int()),
  /** How each kind shows it, which is a sign and never says the kind. */
  reaction: perKind(text),
  /** What goes on the official record, and any hidden risk it adds. */
  sets,
  /** What the player is told as it is completed. */
  done: notice,
});

/**
 * A boss's big ambition, which runs for several months from when the boss takes
 * it on, and which the player can complete in appearance or in reality.
 */
const grandPlan = z.strictObject({
  id,
  floor,
  title: text,
  /** What the player knows of it, once they have heard of it. */
  what: text,
  /** How many months it runs, from the month the boss takes it on. */
  lasts: z.number().int().positive(),
  /** The Scenes and Notifications in which the player hears of it. */
  heardIn: z.array(id).min(1),
  /**
   * What doing it for real needs, which one of `from` really has, dealt as the
   * Plan is taken on. The player has it once they have done `asked` of them.
   */
  needs: z
    .strictObject({
      from: z.array(z.strictObject({ character: id, asked: id })).min(2),
      /** What the results screen says of whoever had it. Says {who}. */
      told: text,
    })
    .optional(),
  ways: z.array(planWay).min(2),
  /** If it is not done in time, the boss looks for someone to blame. */
  failed: z.strictObject({
    blame: z.strictObject({
      /** Whether blame can stick to the player at all. Left out, it can. */
      sticks: condition.optional(),
      /** The seeded chance the player is blamed, by the boss's kind. */
      chance: perKind(z.number().min(0).max(1)),
      /** Added for how the boss stands with the player. */
      mood: z.strictObject({
        warm: z.number(),
        neutral: z.number(),
        cold: z.number(),
      }),
    }),
    onPlayer: bill,
    onSomeoneElse: bill,
  }),
  /** What the results screen says became of it. */
  results: z.strictObject({
    reality: text,
    appearance: text,
    failed: text,
    running: text,
  }),
});

export const grandPlans = z.strictObject({
  /** Where the player's view says it has got to. `running` says {month}. */
  statuses: z.strictObject({ running: text, completed: text, failed: text }),
  /** What a Plan done is titled once its boss is no longer the player's. Left out, its own. */
  formerBoss: text.optional(),
  plans: z.array(grandPlan).min(1),
});

/** Why whoever decides a vacancy might pick someone, by its key in `vacancies.json`. */
export const VACANCY_REASONS = [
  "self",
  "owed",
  "protege",
  "circle",
  "credited",
  "owedYou",
  "calledIn",
  "delivered",
  "results",
  "looks",
  "warm",
  "neutral",
  "cold",
] as const;
export type VacancyReason = (typeof VACANCY_REASONS)[number];

const reason = z.strictObject({
  /** How much it weighs with whoever decides, by their kind. They add up. */
  weight: perKind(z.number().int()),
  /** What the results screen says of it. Says {decider}, and {who} for a Character. */
  why: text,
  /**
   * What the decision says of it, when it is the winner's tie to whoever
   * decided. It never says how anyone feels about the player, or who is a Rival.
   * Left out, it is not told.
   */
  told: text.optional(),
});

/** What a seat act leaves with whoever decides: a memory, and how far it moves their belief. */
const kept = z.strictObject({ text, belief: z.number().int() });

/** A boss's seat, which falls vacant when they move up, and who decides it. */
const seat = z.strictObject({
  id,
  /** The floor it is on: the player is under it while their job is this. */
  floor: id,
  /** The job the player gets by winning it, which takes them to its floor. */
  job: id,
  /** What Rivals compete for while it is open, by its id in `rivals.json`. */
  competing: id,
  /** How many months it stays open, from the month after it falls vacant. */
  openFor: z.number().int().positive(),
  /** Where whoever held it moves up to: whom they answer to, and as what. */
  movesUp: z.strictObject({ reportsTo: id, title: text, called: text }),
  /** Told as it opens. Says {holder} and {month}, the month it is decided in. */
  opened: notice,
  /** Told as it is decided, if the player has it. */
  won: notice,
  /** Told as it is decided, if someone else has it. Says {winner}. */
  lost: notice,
});

/** What a candidate passed over keeps of it. Says {winner}. */
const passed = z.strictObject({
  about: id,
  text,
  tone: z.enum(TONES).optional(),
});

export const vacancies = z.strictObject({
  seats: z.array(seat).min(1),
  /** How the decision's words call the player. */
  you: text,
  /** What each candidate passed over keeps, by whether the player had the seat. */
  passedOver: z.strictObject({ forYou: passed, forSomeoneElse: passed }),
  /** Why whoever decides would pick each candidate, weighed by their own kind. */
  reasons: z.strictObject(
    Object.fromEntries(VACANCY_REASONS.map((r) => [r, reason])) as Record<
      VacancyReason,
      typeof reason
    >,
  ),
  /** How many Moves of the deliver family count as real results. */
  resultsAt: z.number().int().positive(),
  /** How many of the impress and fabricate families make the player look the part. */
  looksAt: z.number().int().positive(),
  /** What each seat act leaves with whoever decides, while a seat is open. */
  acts: z.strictObject({
    /** Approaching whoever decides, or someone with sway with them. */
    approach: z.strictObject({ decider: kept, sway: kept }),
    /** A favour called in through someone with sway with whoever decides. */
    callIn: z.strictObject({ sway: kept }),
    /** A story about the player that reaches whoever decides. */
    story: kept,
    /** Why whoever decides comes to owe a Rival who got into their diary. */
    diary: text,
  }),
  /** Why it went to someone when it was too close to call, or nothing else was written. Says {who}. */
  close: text,
  /** The winner's tie to whoever decided, when nothing else is told. Says {decider}. */
  untold: text,
  /** Beside Official standing: who really decided. Says {decider} and {why}. */
  inFact: text,
  /** On the results screen, after it, when the player did not get it: what counted for them. Says {why}. */
  asForYou: text,
  /** What the results screen says of each vacancy. Says {holder}, {winner} and {month}. */
  results: text,
});
