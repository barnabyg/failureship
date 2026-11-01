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

const notification = z.strictObject({
  id,
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
  label: text,
  description: text,
  place: id,
  cost: id,
  result: notice.optional(),
  scene: id.optional(),
  sets,
});

const move = z.strictObject({
  id,
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
});

const contentSchema = z.strictObject({
  balance: z.strictObject({
    actionsPerMonth: z.number().int().positive(),
    actionCosts: z.record(id, z.number().int().nonnegative()),
  }),
  hiddenTruth: z.strictObject({
    facts: z.array(z.strictObject({ id, text })).min(1),
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
    }),
    actionCount: z.strictObject({ one: text, other: text }),
    costLabel: text,
    freeLabel: text,
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
  const checkCost = (owner: string, cost: string | undefined) => {
    if (cost !== undefined && !(cost in content.balance.actionCosts)) {
      problems.push(`${owner} has unknown cost "${cost}".`);
    }
  };

  for (const a of content.actions) {
    if (!rooms.has(a.place)) {
      problems.push(`Action "${a.id}" is at unknown place "${a.place}".`);
    }
    checkCost(`Action "${a.id}"`, a.cost);
    if (a.scene !== undefined && !scenes.has(a.scene)) {
      problems.push(`Action "${a.id}" opens unknown Scene "${a.scene}".`);
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
