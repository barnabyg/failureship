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
