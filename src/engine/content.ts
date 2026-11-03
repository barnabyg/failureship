import { z } from "zod";
import { colour, floor, id, months, perKind, text } from "./basic-schema";
import {
  boss,
  demands,
  grandPlans,
  overHead,
  reputation,
  vacancies,
} from "./boss-schema";
import {
  changing,
  companyEvent,
  deals,
  gauge,
  mistakes,
  promises,
  risk,
  standing,
  thread,
  type Bill,
} from "./consequence-schema";
import {
  MOVE_FAMILIES,
  projectChange,
  type MoveFamily,
} from "./outcome-schema";
import {
  action,
  buzzword,
  dialog,
  move,
  notification,
  scene,
  storyEntry,
} from "./step-schema";
import {
  behaviour,
  hiddenTruth,
  notebook,
  rivals,
  sources,
} from "./truth-schema";

// The schema is split by mechanic into the *-schema.ts files, and assembled here.
// What the rest of the engine reads of it is exported from here, wherever it is written.
export {
  KINDS,
  MOODS,
  NATURES,
  type Condition,
  type Kind,
  type Mood,
  type Nature,
} from "./basic-schema";
export { DEMAND_ANSWERS, PLAN_HOWS, type PlanHow } from "./boss-schema";
export type { Bill } from "./consequence-schema";
export {
  MOVE_FAMILIES,
  TONES,
  type MoveFamily,
  type Tone,
} from "./outcome-schema";
export {
  CLAIM_STATUSES,
  CLUE_VERDICTS,
  type ClaimStatus,
  type ClueVerdict,
} from "./truth-schema";

export const FITTINGS = [
  "meeting-room",
  "kitchen",
  "desk",
  "cluttered-desk",
  "photocopier",
  "loading-bay",
  "lift",
] as const;

const room = z.strictObject({
  id,
  x: z.number(),
  z: z.number(),
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
  colour,
  /** What the room is furnished as. Without it, the room is a plain box. */
  fittings: z.enum(FITTINGS).optional(),
  /** A label for a place the player can see but not act on. */
  sign: z.strictObject({ title: text, detail: text }).optional(),
});

const project = z.strictObject({
  name: text,
  owner: text,
  /** Best first, which is what `better` and `worse` go by. */
  statuses: z.array(z.strictObject({ id, label: text, colour })).min(2),
  start: z.strictObject({ real: id, reported: id }),
  /** What happens to the Project whatever the player does, as a month opens. */
  events: z
    .array(z.strictObject({ floor, months, text, project: projectChange }))
    .default([]),
  /** Reported as this, the Project is flagged, and has to be explained. */
  flagged: z.strictObject({ at: id, scene: id, cost: id }).optional(),
  /** Who the report needs figures from, and how often they arrive late. */
  input: z
    .strictObject({
      character: id,
      floor,
      /** The months in which they can be late. Left out, any month. */
      months,
      chance: perKind(z.number().min(0).max(1)),
      /** Set for the month when they are late. */
      sets: id,
    })
    .optional(),
});

/** A floor of the tower, which is where one job is done. */
const floorData = z.strictObject({
  /** The job done on this floor, which keys it. */
  job: id,
  /** The job title, as the header and the official story show it. */
  title: text,
  rooms: z.array(room).min(1),
});

/** A place above the player on the Org Chart, and the words for whoever holds it. */
const place = z.strictObject({
  /** How running text refers to them, such as "your boss". */
  called: text,
  /** Their job title while they hold it. Says {title}, their own. */
  title: text,
});

export const contentSchema = z.strictObject({
  balance: z.strictObject({
    actionsPerMonth: z.number().int().positive(),
    monthsPerRun: z.number().int().positive(),
    /** How many months of the run make a quarter, each closed by a review. None, no reviews. */
    monthsPerQuarter: z.number().int().positive().optional(),
    actionCosts: z.record(id, z.number().int().nonnegative()),
    /** How often a Scene's signs swap who holds influence with the next person. */
    signsMisleadChance: z.number().min(0).max(1),
    /** How often a month brings a disaster with no clue. */
    disasterChance: z.number().min(0).max(1).default(0),
    /** The belief at which the boss's mood, and so their treatment, changes. */
    mood: z.strictObject({
      warmAt: z.number().int().positive(),
      coldAt: z.number().int().negative(),
    }),
    /** How much of the boss's belief carries into each new month. */
    bossBeliefKeeps: z.number().min(0).max(1).default(1),
  }),
  boss,
  hiddenTruth,
  rivals: rivals.optional(),
  overHead: overHead.optional(),
  mistakes: mistakes.optional(),
  reputation: reputation.optional(),
  promises: promises.optional(),
  deals: deals.optional(),
  changing: changing.optional(),
  gauges: z.array(gauge).optional(),
  standing: standing.optional(),
  /** What the results screen calls each family of Moves. */
  families: z
    .strictObject(
      Object.fromEntries(
        MOVE_FAMILIES.map((f) => [
          f,
          z.strictObject({ label: text, note: text }),
        ]),
      ) as Record<
        MoveFamily,
        z.ZodObject<{ label: typeof text; note: typeof text }>
      >,
    )
    .optional(),
  sources,
  notebook,
  project,
  demands: demands.optional(),
  grandPlans: grandPlans.optional(),
  vacancies: vacancies.optional(),
  characters: z
    .array(
      z.strictObject({
        id,
        name: text,
        title: text,
        /** How running text refers to them, such as "the Senior Analyst". Left out, their name. */
        called: text.optional(),
        /** What this Character does, which decides the behaviours open to them. */
        role: id.optional(),
        /** Who this Character answers to on the Org Chart. */
        reportsTo: id.optional(),
        /**
         * The floor whose cast they are written for, if not the first. They are
         * in the company from the start, but dealt after the first floor's cast.
         */
        floor,
      }),
    )
    .min(3),
  /** Where the player sits on the Org Chart as a run starts. */
  you: z.strictObject({
    /** Whom the player answers to, who is their boss. */
    reportsTo: id,
    /** Their job, which decides the floor they are on. */
    job: id,
    /** What the Org Chart calls the player, once anyone answers to them. */
    name: text.optional(),
  }),
  /** How text refers to whoever holds each place above the player, while they do. */
  places: z.strictObject({ boss: place, head: place }).partial().default({}),
  behaviours: z.array(behaviour),
  scenes: z.array(scene),
  notifications: z.array(notification),
  dialogs: z.array(dialog),
  buzzwords: z.array(buzzword),
  actions: z.array(action).min(1),
  moves: z.array(move),
  threads: z.array(thread).default([]),
  risks: z.array(risk).default([]),
  events: z.array(companyEvent).default([]),
  officialStory: z.strictObject({
    /** Can say {job}, the player's job title. */
    title: text,
    reportedHeading: text.optional(),
    happenedHeading: text.optional(),
    entries: z.array(storyEntry).min(1),
  }),
  /** The floors of the tower, from the bottom up, each keyed by its job. */
  floors: z.array(floorData).min(1),
  ui: z.strictObject({
    hints: z.strictObject({
      notification: text,
      dialog: text,
      actions: text,
      scene: text,
      "find-out": text,
      claim: text,
      notice: text,
      move: text,
      event: text,
      story: text,
      results: text,
    }),
    actionCount: z.strictObject({ one: text, other: text }),
    /** Says {source}. */
    claimTitle: text,
    clueVerdicts: z.strictObject({ held: text, wrong: text, idle: text }),
    costLabel: text,
    freeLabel: text,
    /** How the results screen says a choice landed with the boss. */
    bossLanded: z.strictObject({ warmer: text, cooler: text, unmoved: text }),
    results: z.strictObject({ title: text, intro: text }),
  }),
});

export type Content = z.infer<typeof contentSchema>;
export type Floor = Content["floors"][number];
export type Room = Floor["rooms"][number];
export type SceneData = Content["scenes"][number];
export type GrandPlan = NonNullable<Content["grandPlans"]>["plans"][number];
export type Seat = NonNullable<Content["vacancies"]>["seats"][number];

/** The Notification that chases a stalled Demand. */
export function chasedIdOf(demandId: string): string {
  return `${demandId}-chased`;
}

/** Every Demand there is: those of a month, and those a missed meeting gives. */
export function everyDemand(content: Content) {
  const { items = [], missed } = content.demands ?? {};
  if (!missed) return items;
  const given = missed.actions.map((action) => ({
    id: action.id,
    months: undefined,
    when: undefined,
    from: action.from,
    subject: action.subject,
    body: action.ask,
    options: missed.options,
    forgotten: missed.forgotten,
    chased: missed.chased,
  }));
  return [...items, ...given];
}

/** Every Bill written, whatever sends it. */
export function everyBill(content: Content): Bill[] {
  return [
    ...content.threads.flatMap((t) => t.outcomes.map((o) => o.bill)),
    ...content.risks.flatMap((r) =>
      r.onSomeoneElse ? [r.onPlayer, r.onSomeoneElse] : [r.onPlayer],
    ),
    ...(content.changing?.whistleblower.reports.map((r) => r.bill) ?? []),
    ...(content.grandPlans?.plans.flatMap((p) => [
      p.failed.onPlayer,
      p.failed.onSomeoneElse,
    ]) ?? []),
  ];
}

/** The Notification that arrives when a commitment falls due. */
export function dueIdOf(id: string): string {
  return `${id}-due`;
}

/** Every Notification there is, including Demands, chasers, Bills and what falls due. */
export function everyNotification(content: Content) {
  const commitments = [
    ...(content.promises?.items ?? []),
    ...(content.deals?.items ?? []),
  ].map((item) => ({
    ...item.due,
    id: dueIdOf(item.id),
    months: undefined,
    when: undefined,
  }));
  const items = everyDemand(content);
  const bills = everyBill(content)
    .filter((b) => b.as === "notification")
    .map((b) => ({
      id: b.id,
      months: undefined,
      when: undefined,
      from: b.from ?? "",
      subject: b.title,
      body: b.body,
      options: b.options,
    }));
  return [
    ...content.notifications,
    ...commitments,
    ...bills,
    ...items,
    ...items.map(({ id: demandId, chased }) => ({
      ...chased,
      id: chasedIdOf(demandId),
      months: undefined,
      when: undefined,
    })),
  ];
}

/** What this Character can be seen doing: what anyone does, and what their role does. */
export function behavioursOpenTo(content: Content, character: string) {
  const role = content.characters.find((c) => c.id === character)?.role;
  return content.behaviours.filter(
    (b) =>
      b.roles === undefined || (role !== undefined && b.roles.includes(role)),
  );
}
