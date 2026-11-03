import { z } from "zod";
import {
  condition,
  floor,
  id,
  months,
  notice,
  pool,
  text,
} from "./basic-schema";
import {
  approachTag,
  bigMistake,
  choiceMistake,
  family,
  headOpinion,
  news,
  notificationOption,
  opinion,
  ownReaction,
  projectChange,
  remembers,
  sets,
  stakes,
} from "./outcome-schema";

export const dialog = z.strictObject({
  id,
  title: text,
  lines: z.array(z.strictObject({ speaker: text.optional(), text })).min(1),
});

export const buzzword = z.strictObject({ id, term: text, meaning: text });

export const notification = z.strictObject({
  id,
  floor,
  months,
  pool,
  /** The Notification waits until this holds, and goes unseen if it never does. */
  when: condition.optional(),
  from: text,
  subject: text,
  body: text,
  options: z.array(notificationOption).min(1),
});

const sceneResult = z.strictObject({
  when: condition.optional(),
  body: text,
  sets,
  opinion,
  headOpinion,
  approach: approachTag,
  reaction: ownReaction,
  project: projectChange,
  mistake: choiceMistake,
  remembers,
  news,
  /** Says on the results screen that a Hidden Fact caused this. */
  factNote: text.optional(),
  /** Whose Hidden Fact it was, unless the option is `about` one. */
  factAt: id.optional(),
});

const sceneOption = z.strictObject({
  id,
  label: text,
  family,
  /** Offers the player's word: a Promise from `promises.json`. */
  promise: id.optional(),
  /** Offers a Deal from `deals.json`, in which each side offers something. */
  deal: id.optional(),
  /** The option appears once the player has heard this Hidden Fact of someone. */
  about: id.optional(),
  /** The option appears only when this holds. */
  requires: condition.optional(),
  stakes,
  results: z.array(sceneResult).min(1),
});

export const scene = z.strictObject({
  id,
  floor,
  months,
  pool,
  title: text,
  location: text,
  narration: z.array(text).min(1),
  cast: z.array(id).min(1),
  signs: z.array(
    z.strictObject({
      label: text,
      text,
      /** What the Notebook keeps of this, if anything. */
      clue: text.optional(),
    }),
  ),
  options: z.array(sceneOption).min(1),
  /** Names code in `sceneScripts`, for a Scene that data cannot express. */
  script: id.optional(),
  /** What the boss finally says of the player, by their mood. */
  verdict: z.strictObject({ warm: text, neutral: text, cold: text }).optional(),
});

export const action = z.strictObject({
  id,
  floor,
  months,
  label: text,
  description: text,
  place: id,
  cost: id,
  family,
  result: notice.optional(),
  /** Further results, used in turn so that a place reads differently each month. */
  moreResults: z.array(notice).default([]),
  scene: id.optional(),
  /** A place like a meeting can be gone to only once a month. */
  oncePerMonth: z.boolean().default(false),
  /** A Find Out action names how the player goes about it. */
  findOut: id.optional(),
  /** This action goes over the boss's head, as `overHead` says. */
  overHead: z.boolean().default(false),
  sets,
  approach: approachTag,
  reaction: ownReaction,
  project: projectChange,
  mistake: bigMistake,
});

export const move = z.strictObject({
  id,
  floor,
  months,
  from: text,
  title: text,
  body: text,
  when: condition.optional(),
  /** Lands ahead of other Moves whenever its condition holds. */
  priority: z.boolean().default(false),
  sets,
  mistake: bigMistake,
  /** Pays back the favour the player owes this Character. */
  repays: id.optional(),
});

export const storyEntry = z
  .strictObject({
    floor,
    months,
    when: condition.optional(),
    reported: text.optional(),
    happened: text.optional(),
  })
  .refine((e) => e.reported !== undefined || e.happened !== undefined, {
    message: "A story entry needs reported or happened text.",
  });
