import { z } from "zod";

const text = z.string().min(1);
const id = z.string().min(1);

const notice = z.strictObject({ title: text, body: text });

/** Flags record what the player did, for later conditions to read. */
const sets = z.array(id).default([]);

/** How far this moves the boss's hidden opinion of the player. */
const opinion = z.number().int().default(0);

/** Something written once for each kind of boss. */
const perKind = <T extends z.ZodType>(value: T) =>
  z.strictObject({ believer: value, incompetent: value, practitioner: value });

/** How the choice comes across, which `boss.approaches` reads by the boss's kind. */
const approachTag = id.optional();

/** This choice's own words for how the boss takes it, in place of the approach's. */
const ownReaction = perKind(text).optional();

/**
 * How a choice or event moves the Project. Each is a status's id, or `better`
 * or `worse`, and a reported status can also be `real`, which tells the truth.
 */
const projectChange = z
  .strictObject({ real: id.optional(), reported: id.optional() })
  .optional();

const notificationOption = z.strictObject({
  id,
  label: text,
  cost: id.optional(),
  dialog: id.optional(),
  learns: z.array(id).default([]),
  sets,
  opinion,
  approach: approachTag,
  reaction: ownReaction,
  project: projectChange,
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
  | { not: Condition }
  | { all: Condition[] };

const condition: z.ZodType<Condition> = z.lazy(() =>
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
    z.strictObject({ not: condition }),
    z.strictObject({ all: z.array(condition).min(1) }),
  ]),
);

const sceneResult = z.strictObject({
  when: condition.optional(),
  body: text,
  sets,
  opinion,
  approach: approachTag,
  reaction: ownReaction,
  project: projectChange,
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
  /** What the boss finally says of the player, by how the opinion stands. */
  verdict: z.strictObject({ warm: text, neutral: text, cold: text }).optional(),
});

const action = z.strictObject({
  id,
  months,
  label: text,
  description: text,
  place: id,
  cost: id,
  result: notice.optional(),
  /** Further results, used in turn so that a place reads differently each month. */
  moreResults: z.array(notice).default([]),
  scene: id.optional(),
  /** A place like a meeting can be gone to only once a month. */
  oncePerMonth: z.boolean().default(false),
  /** A Find Out action names how the player goes about it. */
  findOut: id.optional(),
  sets,
  approach: approachTag,
  reaction: ownReaction,
  project: projectChange,
});

const move = z.strictObject({
  id,
  months,
  from: text,
  title: text,
  body: text,
  when: condition.optional(),
  /** Lands ahead of other Moves whenever its condition holds. */
  priority: z.boolean().default(false),
  sets,
});

const storyEntry = z
  .strictObject({
    months,
    when: condition.optional(),
    reported: text.optional(),
    happened: text.optional(),
  })
  .refine((e) => e.reported !== undefined || e.happened !== undefined, {
    message: "A story entry needs reported or happened text.",
  });

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
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** What the room is furnished as. Without it, the room is a plain box. */
  fittings: z.enum(FITTINGS).optional(),
  /** A label for a place the player can see but not act on. */
  sign: z.strictObject({ title: text, detail: text }).optional(),
});

const kindRule = z.strictObject({
  label: text,
  /** How often this kind is dealt, relative to the others. */
  weight: z.number().nonnegative(),
});

const behaviour = z.strictObject({
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

const lines = z.array(text).min(1);

const sources = z.strictObject({
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

/** A way of coming across, and how each kind of boss takes it. */
const bossApproach = z.strictObject({
  id,
  shift: perKind(z.number().int()),
  /** How each kind shows it, used in turn so that it reads differently each month. */
  reaction: perKind(lines),
  /** Past this many uses in a run, these kinds take it differently. */
  overdone: z
    .strictObject({
      after: z.number().int().positive(),
      shift: perKind(z.number().int()).partial(),
      reaction: perKind(lines).partial(),
    })
    .optional(),
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

export const CLUE_VERDICTS = ["held", "wrong", "idle"] as const;
export type ClueVerdict = (typeof CLUE_VERDICTS)[number];

const notebook = z.strictObject({
  /** Things the player did or saw that the Notebook keeps. */
  events: z.array(
    z.strictObject({
      id,
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

const project = z.strictObject({
  name: text,
  owner: text,
  /** Best first, which is what `better` and `worse` go by. */
  statuses: z.array(z.strictObject({ id, label: text })).min(2),
  start: z.strictObject({ real: id, reported: id }),
  /** What happens to the Project whatever the player does, as a month opens. */
  events: z
    .array(z.strictObject({ months, text, project: projectChange }))
    .default([]),
});

const contentSchema = z.strictObject({
  balance: z.strictObject({
    actionsPerMonth: z.number().int().positive(),
    monthsPerRun: z.number().int().positive(),
    actionCosts: z.record(id, z.number().int().nonnegative()),
    /** How often a Scene's signs swap who holds influence with the next person. */
    signsMisleadChance: z.number().min(0).max(1),
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
    approaches: z.array(bossApproach).default([]),
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
          /** How someone would say it. Says {name}. Left out, `text` is used. */
          told: text.optional(),
          /** Whether it can burn the player, arm them or does neither. */
          nature: z.enum(NATURES).default("idle"),
        }),
      )
      .min(1),
  }),
  sources,
  notebook,
  project,
  characters: z
    .array(
      z.strictObject({
        id,
        name: text,
        title: text,
        /** How running text refers to them, such as "your boss". Left out, their name. */
        called: text.optional(),
        /** What this Character does, which decides the behaviours open to them. */
        role: id.optional(),
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
    clueVerdicts: z.strictObject({ held: text, wrong: text, idle: text }),
    costLabel: text,
    freeLabel: text,
    /** How the results screen says a choice landed with the boss. */
    bossLanded: z.strictObject({ warmer: text, cooler: text, unmoved: text }),
    results: z.strictObject({ title: text, intro: text }),
  }),
});

export type Content = z.infer<typeof contentSchema>;
export type Room = Content["floor"]["rooms"][number];
export type SceneData = Content["scenes"][number];
type SceneResult = SceneData["options"][number]["results"][number];

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
function dependsOnHiddenTruth(
  condition: Condition,
  hiddenFlags: ReadonlySet<string> = new Set(),
): boolean {
  if ("flag" in condition) return hiddenFlags.has(condition.flag);
  if (
    "holderIs" in condition ||
    "bossIs" in condition ||
    "factNature" in condition ||
    "heardTrue" in condition
  ) {
    return true;
  }
  if ("not" in condition) {
    return dependsOnHiddenTruth(condition.not, hiddenFlags);
  }
  if ("all" in condition) {
    return condition.all.some((c) => dependsOnHiddenTruth(c, hiddenFlags));
  }
  return false;
}

/** Flags that say which way a hidden result went, so they carry the truth too. */
function flagsSetByHiddenResults(content: Content): Set<string> {
  const options = content.scenes.flatMap((s) => s.options);
  return new Set(
    options
      .filter((o) =>
        o.results.some((r) => r.when && dependsOnHiddenTruth(r.when)),
      )
      .flatMap((o) => o.results.flatMap((r) => r.sets)),
  );
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
    if (
      !fact.text.includes("{name}") ||
      fact.told?.includes("{name}") === false
    ) {
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

function rolesOf(content: Content): Set<string> {
  return new Set(content.characters.flatMap((c) => c.role ?? []));
}

/** What this Character can be seen doing: what anyone does, and what their role does. */
export function behavioursOpenTo(content: Content, character: string) {
  const role = content.characters.find((c) => c.id === character)?.role;
  return content.behaviours.filter(
    (b) =>
      b.roles === undefined || (role !== undefined && b.roles.includes(role)),
  );
}

/** Signs must narrow the answer without ever settling it. */
function findBrokenBehaviours(content: Content): string[] {
  const problems: string[] = [];
  const nameParts = content.characters.flatMap((c) => c.name.split(" "));
  for (const b of content.behaviours) {
    const owner = `Behaviour "${b.id}"`;
    for (const written of [b.text, b.clue ?? "{who}"]) {
      if (!written.includes("{who}")) {
        problems.push(`${owner} needs to say {who}.`);
      }
      for (const [, token] of written.matchAll(/\{(\w+)\}/g)) {
        if (token !== "who") {
          problems.push(`${owner} uses unknown token "{${token ?? ""}}".`);
        }
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
  const roles = rolesOf(content);
  for (const b of content.behaviours) {
    for (const role of b.roles ?? []) {
      if (!roles.has(role)) {
        problems.push(`Behaviour "${b.id}" names unknown role "${role}".`);
      }
    }
  }
  for (const role of roles) {
    if (
      !content.behaviours.some(
        (b) => b.roles?.length === 1 && b.roles[0] === role,
      )
    ) {
      problems.push(`Role "${role}" has no behaviour of its own.`);
    }
  }
  if (content.behaviours.length > 0) {
    for (const character of content.characters) {
      const open = behavioursOpenTo(content, character.id);
      for (const kind of KINDS) {
        if (open.every((b) => b.likelihood[kind] === 0)) {
          problems.push(
            `Character "${character.id}" has no behaviour to show as a ${kind}.`,
          );
        }
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

/** An approach must split the kinds, and its words must never name one. */
function findBrokenApproaches(content: Content): string[] {
  const problems: string[] = [];
  for (const approach of content.boss.approaches) {
    const owner = `Approach "${approach.id}"`;
    if (new Set(Object.values(approach.shift)).size === 1) {
      problems.push(`${owner} is taken the same way by every kind.`);
    }
    const written = Object.values(approach.reaction).flat();
    problems.push(...findNamedKinds(content, owner, written));
  }
  return problems;
}

/** The player reads a kind from signs, so no reaction may say it out loud. */
function findNamedKinds(
  content: Content,
  owner: string,
  written: readonly string[],
): string[] {
  const labels = Object.values(content.hiddenTruth.kinds).map((k) =>
    k.label.toLowerCase(),
  );
  return written
    .filter((line) => labels.some((l) => line.toLowerCase().includes(l)))
    .map((line) => `${owner} names a kind: "${line}"`);
}

/** Sources must be worth weighing: never always right, and never always wrong. */
function findBrokenSources(content: Content): string[] {
  const { methods, reliability, motives, claims, voices } = content.sources;
  const problems: string[] = [];
  const checkTokens = (owner: string, written: string, tokens: string[]) => {
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
    checkTokens(owner, method.prompt, method.someoneThere ? ["source"] : []);
    for (const frame of method.frames) {
      if (!frame.includes("{said}")) {
        problems.push(`${owner} has a frame that needs {said}: "${frame}"`);
      }
      checkTokens(owner, frame, ["said", "source"]);
    }
    if (Object.values(method.topics).every((t) => t === 0)) {
      problems.push(`${owner} has nothing to claim.`);
    }
  }
  const roles = rolesOf(content);
  for (const [role, spoken] of Object.entries(voices)) {
    const owner = `The voice of "${role}"`;
    if (!roles.has(role))
      problems.push(`A voice names unknown role "${role}".`);
    for (const line of spoken) {
      if (!line.includes("{said}")) {
        problems.push(`${owner} needs to say {said}: "${line}"`);
      }
      checkTokens(owner, line, ["said"]);
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
    checkTokens(`Motive "${motive.id}"`, motive.text, ["name"]);
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
    checkTokens("A claim", line, ["subject"]);
  }
  for (const line of claims.fact) {
    if (!line.includes("{fact}")) {
      problems.push(`A claim about a fact needs to say {fact}: "${line}"`);
    }
    checkTokens("A claim", line, ["fact"]);
  }
  return problems;
}

function findBrokenReferences(content: Content): string[] {
  const rooms = new Set(content.floor.rooms.map((r) => r.id));
  const dialogs = new Set(content.dialogs.map((d) => d.id));
  const buzzwords = new Set(content.buzzwords.map((b) => b.id));
  const scenes = new Set(content.scenes.map((s) => s.id));
  const characters = new Set(content.characters.map((c) => c.id));
  const hiddenFlags = flagsSetByHiddenResults(content);
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
  const checkParts = (owner: string, written: string, about = false) => {
    for (const [, token] of written.matchAll(/\{(\w+)\}/g)) {
      if (about && token === "subject") continue;
      if (token !== "holder" && token !== "ignored" && token !== "bystander") {
        problems.push(`${owner} uses unknown part "{${token ?? ""}}".`);
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
  const checkApproach = (
    owner: string,
    { approach, reaction }: Pick<SceneResult, "approach" | "reaction">,
  ) => {
    if (
      approach !== undefined &&
      !content.boss.approaches.some((a) => a.id === approach)
    ) {
      problems.push(`${owner} uses unknown approach "${approach}".`);
    }
    if (reaction) {
      if (approach === undefined) {
        problems.push(`${owner} has a reaction with no approach to move it.`);
      }
      problems.push(...findNamedKinds(content, owner, Object.values(reaction)));
    }
  };
  const statuses = new Set(content.project.statuses.map((s) => s.id));
  const checkStatus = (owner: string, status: string) => {
    if (!statuses.has(status)) {
      problems.push(`${owner} names unknown status "${status}".`);
    }
  };
  const checkProject = (owner: string, change: SceneResult["project"]) => {
    const { real, reported } = change ?? {};
    const relative = (to: string) => to === "better" || to === "worse";
    if (real !== undefined && !relative(real)) checkStatus(owner, real);
    if (reported !== undefined && !relative(reported) && reported !== "real") {
      checkStatus(owner, reported);
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
  problems.push(...findBrokenApproaches(content));
  problems.push(...findBrokenSources(content));
  checkStatus("The Project", content.project.start.real);
  checkStatus("The Project", content.project.start.reported);
  for (const e of content.project.events) {
    checkMonths("A Project event", e.months);
    checkProject("A Project event", e.project);
  }
  for (const a of content.actions) {
    checkApproach(`Action "${a.id}"`, a);
    checkProject(`Action "${a.id}"`, a.project);
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
      problems.push(`${owner} names parts, which need three people present.`);
    }
    for (const line of s.narration) checkParts(owner, line);
    for (const sign of s.signs) {
      checkParts(owner, sign.text);
      checkParts(owner, sign.clue ?? "");
    }
    for (const o of s.options) {
      const optionOwner = `${owner} option "${o.id}"`;
      const about = o.about !== undefined;
      if (o.about !== undefined) checkFact(optionOwner, o.about);
      checkParts(optionOwner, o.label, about);
      for (const r of o.results) {
        checkParts(optionOwner, r.body, about);
        checkParts(optionOwner, r.factNote ?? "", about);
        if (r.factAt !== undefined) checkCharacter(optionOwner, r.factAt);
        if (r.when) checkCondition(optionOwner, r.when);
        checkApproach(optionOwner, r);
        checkProject(optionOwner, r.project);
      }
      if (o.requires) {
        checkCondition(optionOwner, o.requires);
        if (dependsOnHiddenTruth(o.requires, hiddenFlags)) {
          problems.push(`${optionOwner} is gated on the hidden truth.`);
        }
      }
      if (o.results.at(-1)?.when !== undefined) {
        problems.push(`${optionOwner} needs a fallback result with no "when".`);
      }
    }
  }
  for (const e of content.notebook.events) {
    const owner = `Notebook event "${e.id}"`;
    checkMonths(owner, e.months);
    checkCondition(owner, e.when);
    // A hidden result's flag is fine here: the player has just seen that result.
    if (dependsOnHiddenTruth(e.when)) {
      problems.push(`${owner} is gated on the hidden truth.`);
    }
  }
  for (const m of content.moves) {
    const owner = `Move "${m.id}"`;
    checkMonths(owner, m.months);
    checkParts(owner, m.body);
    if (m.when) checkCondition(owner, m.when);
  }
  for (const e of content.officialStory.entries) {
    const owner = "An official story entry";
    checkParts(owner, e.reported ?? "");
    checkParts(owner, e.happened ?? "");
    if (e.when) checkCondition(owner, e.when);
    checkMonths(owner, e.months);
  }
  for (const n of content.notifications) {
    checkMonths(`Notification "${n.id}"`, n.months);
    for (const [, token] of n.body.matchAll(/\{(\w+)\}/g)) {
      if (token !== "real" && token !== "reported") {
        problems.push(
          `Notification "${n.id}" uses unknown token "{${token ?? ""}}".`,
        );
      }
    }
    for (const o of n.options) {
      const owner = `Notification "${n.id}" option "${o.id}"`;
      checkCost(owner, o.cost);
      checkApproach(owner, o);
      checkProject(owner, o.project);
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
