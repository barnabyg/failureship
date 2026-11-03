import { z } from "zod";
import { id, notice, perKind, text } from "./basic-schema";

/** Flags record what the player did, for later conditions to read. */
export const sets = z.array(id).default([]);

/** How far this moves the boss's hidden belief about the player. */
export const opinion = z.number().int().default(0);

/** How far this moves the hidden belief of the boss's boss. */
export const headOpinion = z.number().int().default(0);

export const MOVE_FAMILIES = [
  "impress",
  "fabricate",
  "trade",
  "find-out",
  "deflect",
  "attack",
  "deliver",
] as const;
export type MoveFamily = (typeof MOVE_FAMILIES)[number];

/** What sort of Move a choice is. Only the results screen ever says. */
export const family = z.enum(MOVE_FAMILIES).optional();

/** How the choice comes across, which `boss.approaches` reads by the boss's kind. */
export const approachTag = id.optional();

/** This choice's own words for how the boss takes it, in place of the approach's. */
export const ownReaction = perKind(text).optional();

/**
 * How a choice or event moves the Project. Each is a status's id, or `better`
 * or `worse`, and a reported status can also be `real`, which tells the truth.
 */
export const projectChange = z
  .strictObject({ real: id.optional(), reported: id.optional() })
  .optional();

/**
 * Whether this is a big mistake. A first is a Final Warning, and a second gets the
 * player fired. Anything that can happen to the player can be one of these.
 */
export const bigMistake = z.literal("big").optional();

/** A choice can also be catastrophic, which gets the player fired outright. */
export const choiceMistake = z.enum(["big", "catastrophic"]).optional();

/** What the player is told before choosing something catastrophic. */
export const stakes = text.optional();

export const TONES = ["good", "bad"] as const;
export type Tone = (typeof TONES)[number];

/** What a Character keeps of this, which later conditions can read. */
export const remembers = z
  .array(
    z.strictObject({
      character: id,
      about: id,
      text,
      /** Whether it moves what they believe of the player, and which way. */
      tone: z.enum(TONES).optional(),
    }),
  )
  .default([]);

/** A deed that can travel, from those it was done in front of, or to. */
export const news = z
  .strictObject({
    about: id,
    tone: z.enum(TONES),
    /** What the results screen says reached them. */
    text,
    at: z.array(id).min(1),
  })
  .optional();

/**
 * A false story, which travels the Power Map as news does until someone sees
 * through it. A Move's is about the player, and starts with whoever made it.
 * A choice's is the player's, about someone else.
 */
export const story = z
  .strictObject({
    /** What `remembers` reads. */
    about: id,
    /** What the results screen says reached people. */
    text,
    /** Whom the player's story is about. */
    of: id.optional(),
    /** Whom the player tells it to first. */
    at: z.array(id).min(1).optional(),
    /** What reaches whoever sees through the player's story: that the player made it up. */
    exposed: z.strictObject({ about: id, text }).optional(),
  })
  .optional();

/**
 * What someone does for an open seat. The player can approach someone about it,
 * call in a favour or claim the Plan's credit; a Rival's Move can also tell a
 * story about the player to whoever decides, or get into their diary. Each does
 * something only while a seat is open, and only through what really decides it.
 */
export const seatAct = z
  .strictObject({
    /** A Character or place: it helps only if they decide, or have sway with whoever does. */
    approach: id.optional(),
    /** Calls in a favour owed by whoever decides, or by someone with sway with them. */
    callIn: z.boolean().optional(),
    /** Claims the credit for the Grand Plan that opened the seat. */
    credit: z.boolean().optional(),
    /** A Move's story about the player, which reaches whoever decides. */
    story: z.boolean().optional(),
    /** A Move's maker gets into the diary of whoever decides, who comes to owe them. */
    diary: z.boolean().optional(),
  })
  .optional();

/** How an answer settles a commitment that has fallen due. */
const settles = z.enum(["kept", "broken"]).optional();

export const notificationOption = z.strictObject({
  id,
  label: text,
  family,
  /** Offers the player's word: a Promise from `promises.json`. */
  promise: id.optional(),
  /** Offers a Deal from `deals.json`, in which each side offers something. */
  deal: id.optional(),
  settles,
  cost: id.optional(),
  dialog: id.optional(),
  learns: z.array(id).default([]),
  sets,
  opinion,
  headOpinion,
  approach: approachTag,
  reaction: ownReaction,
  project: projectChange,
  mistake: choiceMistake,
  remembers,
  news,
  seat: seatAct,
  stakes,
  result: notice.optional(),
  /** Leaves a Demand open, as a bet that the boss forgets it. */
  stalls: z.boolean().default(false),
  /** A seeded chance that this goes the other way, into `lost`. */
  bet: z
    .strictObject({
      chance: z.number().min(0).max(1),
      lost: z.strictObject({
        sets,
        opinion,
        headOpinion,
        approach: approachTag,
        reaction: ownReaction,
        project: projectChange,
        mistake: choiceMistake,
        remembers,
        news,
        settles,
        result: notice,
      }),
    })
    .optional(),
});
