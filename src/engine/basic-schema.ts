import { z } from "zod";

export const text = z.string().min(1);
export const id = z.string().min(1);

export const notice = z.strictObject({ title: text, body: text });

export const lines = z.array(text).min(1);

/** Something written once for each kind of boss. */
export const perKind = <T extends z.ZodType>(value: T) =>
  z.strictObject({ believer: value, incompetent: value, practitioner: value });

/**
 * The months something belongs to, counted on its floor: the month the player
 * is in there. Left out, it belongs to every month.
 */
export const months = z.array(z.number().int().positive()).min(1).optional();

/** The floor something belongs to, by its job. Left out, it belongs to every floor. */
export const floor = id.optional();

/** In its floor's pool, drawn in turn once the floor's written months run out. */
export const pool = z.boolean().optional();

export const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const KINDS = ["believer", "incompetent", "practitioner"] as const;
export type Kind = (typeof KINDS)[number];

export const MOODS = ["warm", "neutral", "cold"] as const;
export type Mood = (typeof MOODS)[number];

export const NATURES = ["dangerous", "useful", "idle"] as const;
export type Nature = (typeof NATURES)[number];

export type Condition =
  | { holderIs: string }
  | { bossIs: Kind }
  | { factNature: { character: string; nature: Nature } }
  | { heardFact: string }
  | { heardTrue: string }
  | { hasBuzzword: string }
  | { flag: string }
  | { did: string }
  | { remembers: { character: string; about: string } }
  | { believes: { character: string; mood: Mood } }
  | { youOwe: string }
  | { sawMove: string }
  | { planRunning: string }
  | { not: Condition }
  | { all: Condition[] }
  | { any: Condition[] };

export const condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ holderIs: id }),
    z.strictObject({ bossIs: z.enum(KINDS) }),
    z.strictObject({
      factNature: z.strictObject({
        character: id,
        nature: z.enum(NATURES),
      }),
    }),
    z.strictObject({ heardFact: id }),
    z.strictObject({ heardTrue: id }),
    z.strictObject({ hasBuzzword: id }),
    z.strictObject({ flag: id }),
    z.strictObject({ did: id }),
    z.strictObject({
      remembers: z.strictObject({ character: id, about: id }),
    }),
    z.strictObject({
      believes: z.strictObject({ character: id, mood: z.enum(MOODS) }),
    }),
    z.strictObject({ youOwe: id }),
    z.strictObject({ sawMove: id }),
    z.strictObject({ planRunning: id }),
    z.strictObject({ not: condition }),
    z.strictObject({ all: z.array(condition).min(1) }),
    z.strictObject({ any: z.array(condition).min(1) }),
  ]),
);
