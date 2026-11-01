import { z } from "zod";

const text = z.string().min(1);
const id = z.string().min(1);

const notice = z.strictObject({ title: text, body: text });

/** Flags record what the player did, for later conditions to read. */
const sets = z.array(id).default([]);

/** How far this moves the boss's hidden opinion of the player. */
const opinion = z.number().int().default(0);

/** How far this moves the hidden opinion of the boss's boss. */
const headOpinion = z.number().int().default(0);

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
const family = z.enum(MOVE_FAMILIES).optional();

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

/**
 * Whether this is a big mistake. A first is a Final Warning, and a second gets the
 * player fired. Anything that can happen to the player can be one of these.
 */
const bigMistake = z.literal("big").optional();

/** A choice can also be catastrophic, which gets the player fired outright. */
const choiceMistake = z.enum(["big", "catastrophic"]).optional();

/** What the player is told before choosing something catastrophic. */
const stakes = text.optional();

/** What a Character keeps of this, which later conditions can read. */
const remembers = z
  .array(z.strictObject({ character: id, about: id, text }))
  .default([]);

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
  | { did: string }
  | { remembers: { character: string; about: string } }
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
    z.strictObject({ did: id }),
    z.strictObject({
      remembers: z.strictObject({ character: id, about: id }),
    }),
    z.strictObject({ not: condition }),
    z.strictObject({ all: z.array(condition).min(1) }),
  ]),
);

const notificationOption = z.strictObject({
  id,
  label: text,
  family,
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
        result: notice,
      }),
    })
    .optional(),
});

/** The months something belongs to. Left out, it belongs to every month. */
const months = z.array(z.number().int().positive()).min(1).optional();

const notification = z.strictObject({
  id,
  months,
  /** The Notification waits until this holds, and goes unseen if it never does. */
  when: condition.optional(),
  from: text,
  subject: text,
  body: text,
  options: z.array(notificationOption).min(1),
});

/**
 * What comes back on the player, usually through someone else. It can do anything
 * another outcome can, and a Thread or a hidden risk can send one.
 */
const bill = z.strictObject({
  id,
  /** How it arrives: told at once, as a Notification, or where Moves land. */
  as: z.enum(["notice", "notification", "move"]),
  /** Who it comes through. A notice needs nobody. */
  from: text.optional(),
  title: text,
  body: text,
  /** The answers, for one that arrives as a Notification. */
  options: z.array(notificationOption).default([]),
  sets,
  opinion,
  headOpinion,
  project: projectChange,
  mistake: bigMistake,
  remembers,
});

export type Bill = z.infer<typeof bill>;

/** A chain of play, from something the player did to where it comes back. */
const thread = z.strictObject({
  id,
  /** The flag that starts it, the first time anything sets it. */
  startedBy: id,
  /** The seeded chance that it ever comes back. */
  chance: z.number().min(0).max(1).default(1),
  /** How many months later it can come back, which is seeded too. */
  after: z.strictObject({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  }),
  /** What the results screen says started it. */
  started: text,
  /** The first that holds plays out. If none does, it comes to nothing. */
  outcomes: z
    .array(
      z.strictObject({
        when: condition.optional(),
        /** What the results screen says came of it. */
        playedOut: text,
        bill,
      }),
    )
    .min(1),
});

/**
 * Something the player's decisions built up. A written item with a source, a route
 * out and a way of being traced, with no simulation behind it.
 */
const risk = z.strictObject({
  id,
  /** The flag that adds it, the first time anything sets it. */
  addedBy: id,
  /** How many months later it can come out, which is seeded. */
  after: z.strictObject({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  }),
  /** What the results screen says was building up. */
  note: text,
  route: z.strictObject({
    /** Who it comes out through. */
    character: id,
    /** The seeded chance they act on it, by their dealt kind. */
    chance: perKind(z.number().min(0).max(1)),
    /** Why they would, for the results screen. */
    motive: text,
    /** What they need to be able to act. Left out, they can. */
    means: condition.optional(),
  }),
  /** Whether it can be traced to the player, as it comes out. */
  traced: condition,
  onPlayer: bill,
  /** What happens if it cannot be traced. Left out, nothing does. */
  onSomeoneElse: bill.optional(),
  landedOnYou: text,
  landedElsewhere: text,
  neverCameOut: text,
});

const chasedDemand = z.strictObject({
  from: text,
  subject: text,
  body: text,
  options: z.array(notificationOption).min(1),
});

/** An instruction from above, which can be answered in the five ways below. */
const demand = notification.extend({
  /** What happens if the boss forgets a stalled Demand. */
  forgotten: notice,
  /** What arrives if the boss chases a stalled Demand instead. */
  chased: chasedDemand,
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
  /** Says on the results screen that a Hidden Fact caused this. */
  factNote: text.optional(),
  /** Whose Hidden Fact it was, unless the option is `about` one. */
  factAt: id.optional(),
});

const sceneOption = z.strictObject({
  id,
  label: text,
  family,
  /** The option appears once the player has heard this Hidden Fact of someone. */
  about: id.optional(),
  /** The option appears only when this holds. */
  requires: condition.optional(),
  stakes,
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
  mistake: bigMistake,
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

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/);

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
  statuses: z.array(z.strictObject({ id, label: text, colour })).min(2),
  start: z.strictObject({ real: id, reported: id }),
  /** What happens to the Project whatever the player does, as a month opens. */
  events: z
    .array(z.strictObject({ months, text, project: projectChange }))
    .default([]),
  /** Reported as this, the Project is flagged, and has to be explained. */
  flagged: z.strictObject({ at: id, scene: id, cost: id }).optional(),
  /** Who the report needs figures from, and how often they arrive late. */
  input: z
    .strictObject({
      character: id,
      /** The months in which they can be late. Left out, any month. */
      months,
      chance: perKind(z.number().min(0).max(1)),
      /** Set for the month when they are late. */
      sets: id,
    })
    .optional(),
});

/** Going over the boss's head: what it can do, and who can find out. */
const overHead = z.strictObject({
  /** Whom the player goes to, whose own hidden opinion this moves. */
  character: id,
  /** How they treat the player in a Scene, by how their opinion stands. */
  signs: z.array(bossSign),
  /** The hidden opinion at which that changes. It moves less often than the boss's. */
  opinion: z.strictObject({
    warmAt: z.number().int().positive(),
    coldAt: z.number().int().negative(),
  }),
  /** How it goes, by the kind of the person gone to. */
  outcomes: perKind(
    z.strictObject({
      /** The seeded chance of it working, by their place on the Power Map. */
      works: z.strictObject({
        influential: z.number().min(0).max(1),
        sidelined: z.number().min(0).max(1),
      }),
      worked: z.strictObject({ influential: lines, sidelined: lines }),
      failed: lines,
    }),
  ),
  /** How far each opinion moves. The boss gains only by what they can make stick. */
  effects: z.strictObject({
    worked: z.strictObject({
      head: z.number().int().positive(),
      boss: z.strictObject({
        influential: z.number().int().positive(),
        sidelined: z.number().int().nonnegative(),
      }),
    }),
    failed: z.strictObject({
      head: z.number().int().negative(),
      boss: z.number().int().nonpositive(),
    }),
  }),
  /** Whether the boss hears of it, which goes by the boss's own kind. */
  findsOut: z.strictObject({
    chance: perKind(z.number().min(0).max(1)),
    /** How much likelier each further trip makes it. */
    perUse: z.number().min(0).max(1),
    shift: z.number().int().negative(),
    title: text,
    reaction: perKind(lines),
  }),
  /** What the results screen says they made of the player. */
  verdict: z.strictObject({ warm: text, neutral: text, cold: text }),
  sets: z.strictObject({ went: id, caught: id }),
});

/** The words of a Final Warning and of being fired. */
const mistakes = z.strictObject({
  finalWarning: notice,
  /** After a second big mistake. */
  fired: notice,
  /** After a catastrophic one. */
  firedOutright: notice,
  /** The results screen's title and opening, for a run that ended this way. */
  results: z.strictObject({ title: text, intro: text }),
  /** How the results screen says the run ended. This one says {month}. */
  firedIn: text,
  finished: text,
});

export const contentSchema = z.strictObject({
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
      /** How much of the opinion carries into each new month. */
      keeps: z.number().min(0).max(1).default(1),
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
  overHead: overHead.optional(),
  mistakes: mistakes.optional(),
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
  demands: z
    .strictObject({
      /** Each month, how likely each kind of boss is to forget or to chase. */
      odds: perKind(
        z.strictObject({
          forgets: z.number().min(0).max(1),
          chases: z.number().min(0).max(1),
        }),
      ),
      /** What being chased costs with each kind, before any answer is given. */
      chasedPenalty: perKind(z.number().int().nonpositive()),
      /** Set for the month when a stalled Demand is forgotten or chased. */
      sets: z.strictObject({ forgotten: id, chased: id }),
      items: z.array(demand),
      /** What a meeting the player does not go to leaves them with. */
      missed: z
        .strictObject({
          /** The flag that going to this month's meeting sets. */
          attended: id,
          /** Set for the month when a meeting is missed. */
          sets,
          /** How each kind of boss takes the absence. */
          approach: id,
          /** The answers, the same for whichever action the minutes record. */
          options: z.array(notificationOption).min(1),
          forgotten: notice,
          chased: chasedDemand,
          /** What the minutes can give. Each is given once in a run. */
          actions: z
            .array(
              z.strictObject({
                id,
                /** What the player is told as the month closes. */
                title: text,
                body: text,
                /** How the Demand arrives the month after. */
                from: text,
                subject: text,
                ask: text,
              }),
            )
            .min(1),
        })
        .optional(),
    })
    .optional(),
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
  threads: z.array(thread).default([]),
  risks: z.array(risk).default([]),
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

export const DEMAND_ANSWERS = [
  "deliver",
  "push-back",
  "hand-off",
  "fake",
  "stall",
] as const;

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
  ];
}

/** Every Notification there is, including Demands, chasers and Bills. */
export function everyNotification(content: Content) {
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
