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
import { notificationOption, sets } from "./outcome-schema";
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
  plans: z.array(grandPlan).min(1),
});
