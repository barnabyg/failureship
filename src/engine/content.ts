import { z } from "zod";

const text = z.string().min(1);
const id = z.string().min(1);

const notice = z.strictObject({ title: text, body: text });

/** Flags record what the player did, for later conditions to read. */
const sets = z.array(id).default([]);

/** How far this moves the boss's hidden opinion of the player. */
const opinion = z.number().int().default(0);

const notificationOption = z.strictObject({
  id,
  label: text,
  cost: id.optional(),
  dialog: id.optional(),
  learns: z.array(id).default([]),
  sets,
  opinion,
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

export const MOODS = ["warm", "neutral", "cold"] as const;
export type Mood = (typeof MOODS)[number];

export const NATURES = ["dangerous", "useful", "idle"] as const;
export type Nature = (typeof NATURES)[number];

export type Condition =
  | { holderIs: string }
  | { factNature: { character: string; nature: Nature } }
  | { heardFact: string }
  | { heardTrue: string }
  | { hasBuzzword: string }
  | { flag: string }
  | { opinionIs: Mood }
  | { not: Condition }
  | { all: Condition[] };

const condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ holderIs: id }),
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
    z.strictObject({ opinionIs: z.enum(MOODS) }),
    z.strictObject({ not: condition }),
    z.strictObject({ all: z.array(condition).min(1) }),
  ]),
);

const sceneResult = z.strictObject({
  when: condition.optional(),
  body: text,
  sets,
  opinion,
  /** Says on the results screen that a Hidden Fact caused this. */
  factNote: text.optional(),
  /** Whose Hidden Fact it was, unless the option is `about` one. */
  factAt: id.optional(),
});

const sceneOption = z.strictObject({
  id,
  label: text,
  /** The option appears once the player has heard this Hidden Fact of someone. */
  about: id.optional(),
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
  /** A Find Out action names how the player goes about it. */
  findOut: id.optional(),
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

export const KINDS = ["believer", "incompetent", "practitioner"] as const;
export type Kind = (typeof KINDS)[number];

const kindRule = z.strictObject({
  label: text,
  /** How often this kind is dealt, relative to the others. */
  weight: z.number().nonnegative(),
});

const behaviour = z.strictObject({
  id,
  /** Says {who}, so that it works for whichever Character shows it. */
  text,
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

const lines = z.array(text).min(1);

const sources = z.strictObject({
  methods: z.array(
    z.strictObject({
      id,
      title: text,
      prompt: text,
      /** Who can be asked this way. */
      sources: z.array(id).min(1),
      /** How often a claim made this way is about each thing. */
      topics: z.strictObject({
        kind: z.number().nonnegative(),
        influence: z.number().nonnegative(),
        fact: z.number().nonnegative(),
      }),
    }),
  ),
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

const bossSign = z.strictObject({
  id,
  text,
  /** How likely each opinion is to show this, relative to its other signs. */
  likelihood: z.strictObject({
    warm: z.number().nonnegative(),
    neutral: z.number().nonnegative(),
    cold: z.number().nonnegative(),
  }),
});

const contentSchema = z.strictObject({
  balance: z.strictObject({
    actionsPerMonth: z.number().int().positive(),
    monthsPerRun: z.number().int().positive(),
    actionCosts: z.record(id, z.number().int().nonnegative()),
    /** The hidden opinion at which the boss's treatment changes. */
    opinion: z.strictObject({
      warmAt: z.number().int().positive(),
      coldAt: z.number().int().negative(),
    }),
  }),
  boss: z.strictObject({
    /** Whose opinion of the player is tracked. */
    character: id,
    signs: z.array(bossSign),
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
          /** Whether it can burn the player, arm them or does neither. */
          nature: z.enum(NATURES).default("idle"),
        }),
      )
      .min(1),
  }),
  sources,
  characters: z
    .array(
      z.strictObject({
        id,
        name: text,
        title: text,
        /** Who this Character answers to on the Org Chart. */
        reportsTo: id.optional(),
      }),
    )
    .min(3),
  behaviours: z.array(behaviour),
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
      "find-out": text,
      claim: text,
      notice: text,
      move: text,
      story: text,
      results: text,
    }),
    actionCount: z.strictObject({ one: text, other: text }),
    /** Says {source}. */
    claimTitle: text,
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
  if (
    "holderIs" in condition ||
    "opinionIs" in condition ||
    "factNature" in condition ||
    "heardTrue" in condition
  ) {
    return true;
  }
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
  const everyone = content.characters;
  const problems: string[] = [];
  if (new Set(everyone.map((c) => c.name)).size < everyone.length) {
    problems.push("Two Characters share a name, which the charts cannot show.");
  }
  if (minPractitioners > everyone.length) {
    problems.push(
      `The deal wants ${String(minPractitioners)} Practitioners from ${String(everyone.length)} Characters.`,
    );
  }
  if (Object.values(kinds).every((k) => k.weight === 0)) {
    problems.push("The deal needs a kind with a weight above zero.");
  }
  if (charactersWithFact * 2 <= everyone.length) {
    problems.push("The deal must give most Characters a Hidden Fact.");
  }
  if (charactersWithFact > everyone.length) {
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
  for (const { id: character } of everyone) {
    const open = facts.filter((f) => f.characters?.includes(character) ?? true);
    if (open.length < charactersWithFact) {
      problems.push(`Too few Hidden Facts can be dealt to "${character}".`);
    }
  }
  return problems;
}

/** Signs must narrow the answer without ever settling it. */
function findBrokenBehaviours(content: Content): string[] {
  const problems: string[] = [];
  const nameParts = content.characters.flatMap((c) => c.name.split(" "));
  for (const b of content.behaviours) {
    const owner = `Behaviour "${b.id}"`;
    if (!b.text.includes("{who}")) {
      problems.push(`${owner} needs to say {who}.`);
    }
    for (const [, token] of b.text.matchAll(/\{(\w+)\}/g)) {
      if (token !== "who") {
        problems.push(`${owner} uses unknown token "{${token ?? ""}}".`);
      }
    }
    const words = b.text.split(/\W+/);
    if (nameParts.some((part) => words.includes(part))) {
      problems.push(`${owner} names a Character, not a kind of person.`);
    }
    const likelihoods = Object.values(b.likelihood);
    if (likelihoods.filter((l) => l > 0).length < 2) {
      problems.push(`${owner} can come from only one kind.`);
    }
    if (new Set(likelihoods).size === 1) {
      problems.push(`${owner} gives no evidence: every kind is as likely.`);
    }
  }
  if (content.behaviours.length > 0) {
    for (const kind of ["believer", "incompetent", "practitioner"] as const) {
      if (content.behaviours.every((b) => b.likelihood[kind] === 0)) {
        problems.push(`No behaviour can be shown by a ${kind}.`);
      }
    }
  }
  return problems;
}

/** The boss's signs must point somewhere without ever settling it. */
function findBrokenBossSigns(content: Content): string[] {
  const { character, signs } = content.boss;
  const problems: string[] = [];
  if (!content.characters.some((c) => c.id === character)) {
    problems.push(`The boss names unknown Character "${character}".`);
  }
  for (const sign of signs) {
    const owner = `Boss sign "${sign.id}"`;
    for (const [, token] of sign.text.matchAll(/\{(\w+)\}/g)) {
      problems.push(`${owner} uses unknown token "{${token ?? ""}}".`);
    }
    const likelihoods = Object.values(sign.likelihood);
    if (likelihoods.filter((l) => l > 0).length < 2) {
      problems.push(`${owner} can come from only one opinion.`);
    }
    if (new Set(likelihoods).size === 1) {
      problems.push(`${owner} gives no evidence: every opinion is as likely.`);
    }
  }
  if (signs.length > 0) {
    for (const mood of MOODS) {
      if (signs.every((s) => s.likelihood[mood] === 0)) {
        problems.push(`No boss sign can show a ${mood} opinion.`);
      }
    }
  }
  return problems;
}

/** Sources must be worth weighing: never always right, and never always wrong. */
function findBrokenSources(content: Content): string[] {
  const { methods, reliability, motives, claims } = content.sources;
  const problems: string[] = [];
  const allowed = (owner: string, written: string, tokens: string[]) => {
    for (const [, token] of written.matchAll(/\{(\w+)\}/g)) {
      if (!tokens.includes(token ?? "")) {
        problems.push(`${owner} uses unknown token "{${token ?? ""}}".`);
      }
    }
  };
  for (const method of methods) {
    const owner = `Find Out method "${method.id}"`;
    for (const source of method.sources) {
      if (!content.characters.some((c) => c.id === source)) {
        problems.push(`${owner} names unknown Character "${source}".`);
      }
    }
    if (Object.values(method.topics).every((t) => t === 0)) {
      problems.push(`${owner} has nothing to claim.`);
    }
  }
  for (const kind of KINDS) {
    for (const motive of motives) {
      const open = CLAIM_STATUSES.filter(
        (s) => reliability[kind][s] + motive.adjust[s] > 0,
      );
      if (open.length < 2) {
        problems.push(
          `A ${kind} with motive "${motive.id}" would always be read the same way.`,
        );
      }
    }
  }
  for (const motive of motives) {
    allowed(`Motive "${motive.id}"`, motive.text, ["name"]);
  }
  const pools = [
    ...KINDS.flatMap((k) => claims.kind[k]),
    ...claims.influence.high,
    ...claims.influence.low,
  ];
  for (const line of pools) {
    if (!line.includes("{subject}")) {
      problems.push(`A claim needs to say {subject}: "${line}"`);
    }
    allowed("A claim", line, ["subject"]);
  }
  for (const line of claims.fact) {
    if (!line.includes("{fact}")) {
      problems.push(`A claim about a fact needs to say {fact}: "${line}"`);
    }
    allowed("A claim", line, ["fact"]);
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
  const checkFact = (owner: string, fact: string) => {
    if (!content.hiddenTruth.facts.some((f) => f.id === fact)) {
      problems.push(`${owner} names unknown Hidden Fact "${fact}".`);
    }
  };
  const checkCondition = (owner: string, condition: Condition) => {
    if ("holderIs" in condition) checkCharacter(owner, condition.holderIs);
    if ("factNature" in condition) {
      checkCharacter(owner, condition.factNature.character);
    }
    if ("heardFact" in condition) checkFact(owner, condition.heardFact);
    if ("heardTrue" in condition) checkFact(owner, condition.heardTrue);
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
  const checkRoles = (owner: string, written: string, about = false) => {
    for (const [, token] of written.matchAll(/\{(\w+)\}/g)) {
      if (about && token === "subject") continue;
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
  problems.push(...findBrokenBehaviours(content));
  problems.push(...findBrokenBossSigns(content));
  problems.push(...findBrokenSources(content));
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
    const outcomes = [a.scene, a.result, a.findOut].filter(
      (o) => o !== undefined,
    );
    if (outcomes.length !== 1) {
      problems.push(
        `Action "${a.id}" needs one of a Scene, a result or a Find Out.`,
      );
    }
    if (
      a.findOut !== undefined &&
      !content.sources.methods.some((m) => m.id === a.findOut)
    ) {
      problems.push(`Action "${a.id}" uses unknown Find Out "${a.findOut}".`);
    }
  }
  for (const c of content.characters) {
    const owner = `Character "${c.id}"`;
    if (c.reportsTo !== undefined) checkCharacter(owner, c.reportsTo);
    const seen = new Set([c.id]);
    let above = content.characters.find((m) => m.id === c.reportsTo);
    while (above) {
      if (seen.has(above.id)) {
        problems.push(`${owner} is in a loop on the Org Chart.`);
        break;
      }
      seen.add(above.id);
      const manager = above.reportsTo;
      above = content.characters.find((m) => m.id === manager);
    }
  }
  for (const s of content.scenes) {
    const owner = `Scene "${s.id}"`;
    checkMonths(owner, s.months);
    for (const c of s.cast) checkCharacter(owner, c);
    if (
      s.cast.length < 3 &&
      /\{(holder|ignored|bystander)\}/.test(JSON.stringify(s))
    ) {
      problems.push(`${owner} names roles, which need three people present.`);
    }
    for (const line of s.narration) checkRoles(owner, line);
    for (const sign of s.signs) checkRoles(owner, sign.text);
    for (const o of s.options) {
      const optionOwner = `${owner} option "${o.id}"`;
      const about = o.about !== undefined;
      if (o.about !== undefined) checkFact(optionOwner, o.about);
      checkRoles(optionOwner, o.label, about);
      for (const r of o.results) {
        checkRoles(optionOwner, r.body, about);
        checkRoles(optionOwner, r.factNote ?? "", about);
        if (r.factAt !== undefined) checkCharacter(optionOwner, r.factAt);
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
