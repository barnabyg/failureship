import { z } from "zod";
import {
  condition,
  floor,
  id,
  lines,
  months,
  NATURES,
  text,
} from "./basic-schema";

const kindRule = z.strictObject({
  label: text,
  /** How often this kind is dealt, relative to the others. */
  weight: z.number().nonnegative(),
});

export const behaviour = z.strictObject({
  id,
  /** Says {who}, so that it works for whichever Character shows it. */
  text,
  /** What the Notebook keeps of this, if anything. Says {who} too. */
  clue: text.optional(),
  /** Only Characters with one of these roles can show this. Left out, anyone can. */
  roles: z.array(id).min(1).optional(),
  /** How likely each kind is to show this, relative to its other behaviours. */
  likelihood: z.strictObject({
    believer: z.number().nonnegative(),
    incompetent: z.number().nonnegative(),
    practitioner: z.number().nonnegative(),
  }),
});

export const CLAIM_STATUSES = [
  "true",
  "mistaken",
  "outOfDate",
  "false",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

const statusWeights = (number: z.ZodNumber) =>
  z.strictObject({
    true: number,
    mistaken: number,
    outOfDate: number,
    false: number,
  });

export const sources = z.strictObject({
  methods: z.array(
    z.strictObject({
      id,
      title: text,
      prompt: text,
      /** Who can be asked this way. */
      sources: z.array(id).min(1),
      /** The conversation around a claim. Says {said}, and can say {source}. */
      frames: lines,
      /** One of them is already there, so the player does not choose. */
      someoneThere: z.boolean().default(false),
      /** How often a claim made this way is about each thing. */
      topics: z.strictObject({
        kind: z.number().nonnegative(),
        influence: z.number().nonnegative(),
        fact: z.number().nonnegative(),
      }),
    }),
  ),
  /** How each role talks around a claim. Says {said}. A role left out speaks plainly. */
  voices: z.record(id, lines).default({}),
  /** How many people, from the top of the Power Map, count as influential. */
  influentialCount: z.number().int().positive(),
  /** How often each kind of source gives each sort of claim. */
  reliability: z.strictObject({
    believer: statusWeights(z.number().nonnegative()),
    incompetent: statusWeights(z.number().nonnegative()),
    practitioner: statusWeights(z.number().nonnegative()),
  }),
  /** What a source wants, dealt per run. It shifts the weights above. */
  motives: z
    .array(
      z.strictObject({
        id,
        /** Says {name}, and is shown on the results screen. */
        text,
        adjust: statusWeights(z.number()),
      }),
    )
    .min(1),
  /** The words of a claim, which say nothing of whether it is true. */
  claims: z.strictObject({
    kind: z.strictObject({
      believer: lines,
      incompetent: lines,
      practitioner: lines,
    }),
    influence: z.strictObject({ high: lines, low: lines }),
    fact: lines,
  }),
  /** What the results screen says of each sort of claim. */
  verdicts: z.strictObject({
    true: z.strictObject({ label: text, note: text }),
    mistaken: z.strictObject({ label: text, note: text }),
    outOfDate: z.strictObject({ label: text, note: text }),
    false: z.strictObject({ label: text, note: text }),
  }),
});

export const CLUE_VERDICTS = ["held", "wrong", "idle"] as const;
export type ClueVerdict = (typeof CLUE_VERDICTS)[number];

export const notebook = z.strictObject({
  /** Things the player did or saw that the Notebook keeps. */
  events: z.array(
    z.strictObject({
      id,
      floor,
      months,
      /** Noted when this first holds in a month. */
      when: condition,
      source: text,
      text,
      /** What the results screen says of it. */
      verdict: z.enum(CLUE_VERDICTS),
    }),
  ),
});

/** Who is what, and the Hidden Facts, dealt afresh each run. */
export const hiddenTruth = z.strictObject({
  kinds: z.strictObject({
    believer: kindRule,
    incompetent: kindRule,
    practitioner: kindRule,
  }),
  /** Every deal has at least this many, so there is always something to find. */
  minPractitioners: z.number().int().positive(),
  /** How many Characters are dealt a Hidden Fact. */
  charactersWithFact: z.number().int().positive(),
  facts: z
    .array(
      z.strictObject({
        id,
        /** Says {name}, so that it reads correctly for whoever is dealt it. */
        text,
        /** Who it can be dealt to. Left out, it suits anyone. */
        characters: z.array(id).min(1).optional(),
        /** How someone would say it. Says {name}. Left out, `text` is used. */
        told: text.optional(),
        /** Whether it can burn the player, arm them or does neither. */
        nature: z.enum(NATURES).default("idle"),
      }),
    )
    .min(1),
});
