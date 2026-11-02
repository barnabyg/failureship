import { z } from "zod";
import { id, lines, notice, perKind, text } from "./basic-schema";
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

export const boss = z.strictObject({
  /** Whose belief about the player is tracked. */
  character: id,
  signs: z.array(bossSign),
  approaches: z.array(bossApproach).default([]),
});

/** Going over the boss's head: what it can do, and who can find out. */
export const overHead = z.strictObject({
  /** Whom the player goes to, whose own hidden belief this moves. */
  character: id,
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
});

const chasedDemand = z.strictObject({
  from: text,
  subject: text,
  body: text,
  options: z.array(notificationOption).min(1),
});

/** An instruction from above, which can be answered in the five ways below. */
const demand = notification.extend({
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
