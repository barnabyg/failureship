import { z } from "zod";

const text = z.string().min(1);
const id = z.string().min(1);

const notice = z.strictObject({ title: text, body: text });

const action = z.strictObject({
  id,
  label: text,
  description: text,
  place: id,
  cost: id,
  result: notice,
});

const room = z.strictObject({
  id,
  label: text,
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
  }),
  actions: z.array(action).min(1),
  officialStory: z.strictObject({
    title: text,
    reported: z.array(text).min(1),
  }),
  floor: z.strictObject({ rooms: z.array(room).min(1) }),
  ui: z.strictObject({
    hints: z.strictObject({ actions: text, notice: text, story: text }),
    actionCount: z.strictObject({ one: text, other: text }),
    costLabel: text,
  }),
});

export type Content = z.infer<typeof contentSchema>;
export type Room = Content["floor"]["rooms"][number];

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

function findBrokenReferences(content: Content): string[] {
  const rooms = new Set(content.floor.rooms.map((r) => r.id));
  const problems: string[] = [];
  for (const a of content.actions) {
    if (!rooms.has(a.place)) {
      problems.push(`Action "${a.id}" is at unknown place "${a.place}".`);
    }
    if (!(a.cost in content.balance.actionCosts)) {
      problems.push(`Action "${a.id}" has unknown cost "${a.cost}".`);
    }
  }
  return problems;
}
