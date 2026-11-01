import { z } from "zod";

const text = z.string().min(1);
const id = z.string().min(1);

const notice = z.strictObject({ title: text, body: text });

/** Flags record what the player did, for later conditions to read. */
const sets = z.array(id).default([]);

const notificationOption = z.strictObject({
  id,
  label: text,
  cost: id.optional(),
  dialog: id.optional(),
  learns: z.array(id).default([]),
  sets,
  result: notice.optional(),
});

/** The months something belongs to. Left out, it belongs to every month. */
const months = z.array(z.number().int().positive()).min(1).optional();

const notification = z.strictObject({
  id,
  months,
  from: text,
  subject: text,
  body: text,
  options: z.array(notificationOption).min(1),
});

const dialog = z.strictObject({
  id,
  title: text,
  lines: z.array(z.strictObject({ speaker: text.optional(), text })).min(1),
});

const buzzword = z.strictObject({ id, term: text, meaning: text });

export type Condition =
  | { holderIs: string }
  | { hasBuzzword: string }
  | { flag: string }
  | { not: Condition }
  | { all: Condition[] };

const condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ holderIs: id }),
    z.strictObject({ hasBuzzword: id }),
    z.strictObject({ flag: id }),
    z.strictObject({ not: condition }),
    z.strictObject({ all: z.array(condition).min(1) }),
  ]),
);

const sceneResult = z.strictObject({
  when: condition.optional(),
  body: text,
  sets,
});

const sceneOption = z.strictObject({
  id,
  label: text,
  /** The option appears only when this holds. */
  requires: condition.optional(),
  results: z.array(sceneResult).min(1),
});

const scene = z.strictObject({
  id,
  months,
  title: text,
  location: text,
  narration: z.array(text).min(1),
  cast: z.array(id).min(1),
  signs: z.array(z.strictObject({ label: text, text })),
  options: z.array(sceneOption).min(1),
  /** Names code in `sceneScripts`, for a Scene that data cannot express. */
  script: id.optional(),
});

const action = z.strictObject({
  id,
  months,
  label: text,
  description: text,
  place: id,
  cost: id,
  result: notice.optional(),
  scene: id.optional(),
  /** A place like a meeting can be gone to only once a month. */
  oncePerMonth: z.boolean().default(false),
  sets,
});

const move = z.strictObject({
  id,
  months,
  from: text,
  title: text,
  body: text,
  when: condition.optional(),
  sets,
});

const storyEntry = z
  .strictObject({
    when: condition.optional(),
    reported: text.optional(),
    happened: text.optional(),
  })
  .refine((e) => e.reported !== undefined || e.happened !== undefined, {
    message: "A story entry needs reported or happened text.",
  });

const room = z.strictObject({
  id,
  x: z.number(),
  z: z.number(),
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  lift: z.boolean().default(false),
  /** A label for a place the player can see but not act on. */
  sign: z.strictObject({ title: text, detail: text }).optional(),
});

export type Kind = "believer" | "incompetent" | "practitioner";

const kindRule = z.strictObject({
  label: text,
  /** How often this kind is dealt, relative to the others. */
  weight: z.number().nonnegative(),
});

const contentSchema = z.strictObject({
  balance: z.strictObject({
    actionsPerMonth: z.number().int().positive(),
    monthsPerRun: z.number().int().positive(),
    actionCosts: z.record(id, z.number().int().nonnegative()),
  }),
  hiddenTruth: z.strictObject({
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
        }),
      )
      .min(1),
    /** Who may be dealt a role in the Power Map. Needs at least three people. */
    cast: z.array(id).min(3),
  }),
  characters: z.array(z.strictObject({ id, name: text, title: text })),
  scenes: z.array(scene),
  notifications: z.array(notification),
  dialogs: z.array(dialog),
  buzzwords: z.array(buzzword),
  actions: z.array(action).min(1),
  moves: z.array(move),
  officialStory: z.strictObject({
    title: text,
    reportedHeading: text.optional(),
    happenedHeading: text.optional(),
    entries: z.array(storyEntry).min(1),
  }),
  floor: z.strictObject({ rooms: z.array(room).min(1) }),
  ui: z.strictObject({
    hints: z.strictObject({
      notification: text,
      dialog: text,
      actions: text,
      scene: text,
      notice: text,
      move: text,
      story: text,
      results: text,
    }),
    actionCount: z.strictObject({ one: text, other: text }),
    costLabel: text,
    freeLabel: text,
    results: z.strictObject({ title: text, intro: text }),
  }),
});

export type Content = z.infer<typeof contentSchema>;
export type Room = Content["floor"]["rooms"][number];
export type SceneData = Content["scenes"][number];

/** Thrown when a data file breaks the content format, naming what is wrong. */
export class ContentError extends Error {
  override name = "ContentError";
}

/** Checks hand-written content, so that a typo fails loudly at start-up. */
export function parseContent(raw: unknown): Content {
  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ContentError(z.prettifyError(parsed.error));
  }
  const content = parsed.data;
  const problems = findBrokenReferences(content);
  if (problems.length > 0) throw new ContentError(problems.join("\n"));
  return content;
}

/** Showing or hiding an option on this would tell the player the truth. */
function dependsOnHiddenTruth(condition: Condition): boolean {
  if ("holderIs" in condition) return true;
  if ("not" in condition) return dependsOnHiddenTruth(condition.not);
  if ("all" in condition) return condition.all.some(dependsOnHiddenTruth);
  return false;
}

function findBrokenDeal(
  content: Content,
  characters: ReadonlySet<string>,
): string[] {
  const { kinds, minPractitioners, charactersWithFact, facts } =
    content.hiddenTruth;
  const cast = content.characters;
  const problems: string[] = [];
  if (minPractitioners > cast.length) {
    problems.push(
      `The deal wants ${String(minPractitioners)} Practitioners from ${String(cast.length)} Characters.`,
    );
  }
  if (Object.values(kinds).every((k) => k.weight === 0)) {
    problems.push("The deal needs a kind with a weight above zero.");
  }
  if (charactersWithFact * 2 <= cast.length) {
    problems.push("The deal must give most Characters a Hidden Fact.");
  }
  if (charactersWithFact > cast.length) {
    problems.push("The deal wants more Hidden Facts than Characters.");
  }
  for (const fact of facts) {
    const owner = `Hidden Fact "${fact.id}"`;
    if (!fact.text.includes("{name}")) {
      problems.push(`${owner} needs to say {name}.`);
    }
    for (const [, token] of fact.text.matchAll(/\{(\w+)\}/g)) {
      if (token !== "name") {
        problems.push(`${owner} uses unknown token "{${token ?? ""}}".`);
      }
    }
    for (const c of fact.characters ?? []) {
      if (!characters.has(c)) {
        problems.push(`${owner} names unknown Character "${c}".`);
      }
    }
  }
  // With this many open to everyone, dealing can never run out, in any order.
  for (const { id: character } of cast) {
    const open = facts.filter((f) => f.characters?.includes(character) ?? true);
    if (open.length < charactersWithFact) {
      problems.push(`Too few Hidden Facts can be dealt to "${character}".`);
    }
  }
  return problems;
}

function findBrokenReferences(content: Content): string[] {
  const rooms = new Set(content.floor.rooms.map((r) => r.id));
  const dialogs = new Set(content.dialogs.map((d) => d.id));
  const buzzwords = new Set(content.buzzwords.map((b) => b.id));
  const scenes = new Set(content.scenes.map((s) => s.id));
  const characters = new Set(content.characters.map((c) => c.id));
  const problems: string[] = [];
  const checkCharacter = (owner: string, character: string) => {
    if (!characters.has(character)) {
      problems.push(`${owner} names unknown Character "${character}".`);
    }
  };
  const checkCondition = (owner: string, condition: Condition) => {
    if ("holderIs" in condition) checkCharacter(owner, condition.holderIs);
    if ("not" in condition) checkCondition(owner, condition.not);
    if ("all" in condition) {
      for (const inner of condition.all) checkCondition(owner, inner);
    }
    if ("hasBuzzword" in condition && !buzzwords.has(condition.hasBuzzword)) {
      problems.push(
        `${owner} needs unknown Buzzword "${condition.hasBuzzword}".`,
      );
    }
  };
  const checkRoles = (owner: string, written: string) => {
    for (const [, token] of written.matchAll(/\{(\w+)\}/g)) {
      if (token !== "holder" && token !== "ignored" && token !== "bystander") {
        problems.push(`${owner} uses unknown role "{${token ?? ""}}".`);
      }
    }
  };
  const checkMonths = (owner: string, wanted: readonly number[] = []) => {
    for (const month of wanted) {
      if (month > content.balance.monthsPerRun) {
        problems.push(
          `${owner} is set in month ${String(month)}, past the run.`,
        );
      }
    }
  };
  const checkCost = (owner: string, cost: string | undefined) => {
    if (cost !== undefined && !(cost in content.balance.actionCosts)) {
      problems.push(`${owner} has unknown cost "${cost}".`);
    }
  };

  problems.push(...findBrokenDeal(content, characters));
  for (const a of content.actions) {
    if (!rooms.has(a.place)) {
      problems.push(`Action "${a.id}" is at unknown place "${a.place}".`);
    }
    checkCost(`Action "${a.id}"`, a.cost);
    checkMonths(`Action "${a.id}"`, a.months);
    if (a.scene !== undefined && !scenes.has(a.scene)) {
      problems.push(`Action "${a.id}" opens unknown Scene "${a.scene}".`);
    }
    const opens = content.scenes.find((s) => s.id === a.scene);
    if (
      a.months &&
      opens?.months &&
      !a.months.some((month) => opens.months?.includes(month))
    ) {
      problems.push(`Action "${a.id}" is set when its Scene never opens.`);
    }
    if ((a.scene === undefined) === (a.result === undefined)) {
      problems.push(`Action "${a.id}" needs a Scene or a result, not both.`);
    }
  }
  for (const c of content.hiddenTruth.cast) {
    checkCharacter("The hidden truth's cast", c);
  }
  for (const s of content.scenes) {
    const owner = `Scene "${s.id}"`;
    checkMonths(owner, s.months);
    for (const c of s.cast) checkCharacter(owner, c);
    for (const line of s.narration) checkRoles(owner, line);
    for (const sign of s.signs) checkRoles(owner, sign.text);
    for (const o of s.options) {
      const optionOwner = `${owner} option "${o.id}"`;
      checkRoles(optionOwner, o.label);
      for (const r of o.results) {
        checkRoles(optionOwner, r.body);
        if (r.when) checkCondition(optionOwner, r.when);
      }
      if (o.requires) {
        checkCondition(optionOwner, o.requires);
        if (dependsOnHiddenTruth(o.requires)) {
          problems.push(`${optionOwner} is gated on the hidden truth.`);
        }
      }
      if (o.results.at(-1)?.when !== undefined) {
        problems.push(`${optionOwner} needs a fallback result with no "when".`);
      }
    }
  }
  for (const m of content.moves) {
    const owner = `Move "${m.id}"`;
    checkMonths(owner, m.months);
    checkRoles(owner, m.body);
    if (m.when) checkCondition(owner, m.when);
  }
  for (const e of content.officialStory.entries) {
    const owner = "An official story entry";
    checkRoles(owner, e.reported ?? "");
    checkRoles(owner, e.happened ?? "");
    if (e.when) checkCondition(owner, e.when);
  }
  for (const n of content.notifications) {
    checkMonths(`Notification "${n.id}"`, n.months);
    for (const o of n.options) {
      const owner = `Notification "${n.id}" option "${o.id}"`;
      checkCost(owner, o.cost);
      if (o.dialog !== undefined && !dialogs.has(o.dialog)) {
        problems.push(`${owner} opens unknown dialog "${o.dialog}".`);
      }
      for (const word of o.learns) {
        if (!buzzwords.has(word)) {
          problems.push(`${owner} teaches unknown Buzzword "${word}".`);
        }
      }
    }
  }
  return problems;
}
