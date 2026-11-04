import { z } from "zod";
import {
  condition,
  floor,
  id,
  lines,
  notice,
  perKind,
  text,
} from "./basic-schema";
import {
  bigMistake,
  headOpinion,
  news,
  notificationOption,
  opinion,
  projectChange,
  remembers,
  sets,
} from "./outcome-schema";

/**
 * What comes back on the player, usually through someone else. It can do anything
 * another outcome can, and a Thread or a hidden risk can send one.
 */
export const bill = z.strictObject({
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
  news,
});

export type Bill = z.infer<typeof bill>;

/** A chain of play, from something the player did to where it comes back. */
export const thread = z.strictObject({
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
        /** How it moves the player's Gauges, as the month closes. */
        gauges: z
          .array(
            z.strictObject({
              gauge: id,
              by: z.number().int(),
              /** What the player is told moved it. */
              note: text,
            }),
          )
          .default([]),
      }),
    )
    .min(1),
});

/**
 * Something the player's decisions built up. A written item with a source, a route
 * out and a way of being traced, with no simulation behind it.
 */
export const risk = z.strictObject({
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
  /** A Company Event that lands as it comes out, as well as anything below. */
  event: id.optional(),
  /** What happens if it cannot be traced. Left out, nothing does. */
  onSomeoneElse: bill.optional(),
  landedOnYou: text,
  landedElsewhere: text,
  neverCameOut: text,
});

/**
 * Something that happens to the company as a whole. A risk can name one, or it has
 * a `schedule`, or it is a `disaster`, which arrives with no clue. It has no way of
 * being a big mistake, so a surprise is never unfair by itself.
 */
export const companyEvent = z.strictObject({
  id,
  from: text,
  title: text,
  body: text,
  /** What the results screen says it changed on the charts. */
  changed: text.optional(),
  /** From outside: the months it can land in, and a clue before it does. */
  schedule: z
    .strictObject({
      months: z.array(z.number().int().positive()).min(1),
      /** The seeded chance in each of those months, until it lands. */
      chance: z.number().min(0).max(1),
      clue: z
        .strictObject({
          before: z.number().int().positive(),
          source: text,
          text,
        })
        .optional(),
    })
    .optional(),
  /** Drawn at `balance.disasterChance`, with no clue. */
  disaster: z.boolean().default(false),
  /** Lands only while the player's job is this floor's. Left out, on any floor. */
  floor,
  /** Opens the player's boss's seat: they move up, or a post is created out of their team. */
  vacates: z.enum(["movedUp", "created"]).optional(),
  /** Who moves on the Org Chart, and who rises or falls on the Power Map. */
  reshuffle: z
    .strictObject({
      reports: z.array(z.strictObject({ character: id, to: id })).default([]),
      rises: z.array(id).default([]),
      falls: z.array(id).default([]),
    })
    .default({ reports: [], rises: [], falls: [] }),
  /** The official story's own way of reporting it. */
  story: z.strictObject({ reported: text, happened: text.optional() }),
  sets,
  project: projectChange,
});

/** The words of a Final Warning and of being fired. */
export const mistakes = z.strictObject({
  finalWarning: notice,
  /** After a second big mistake. */
  fired: notice,
  /** After a catastrophic one. */
  firedOutright: notice,
  /**
   * As the month of a big mistake closes, on a floor the player won a seat to,
   * which takes them back down. Says {boss}, whoever they answer to now. The
   * checks make sure it is written wherever seats are.
   */
  demoted: notice.optional(),
  /** The results screen's title and opening, for a run that ended this way. */
  results: z.strictObject({ title: text, intro: text }),
  /** How the results screen says the run ended. This one says {month}. */
  firedIn: text,
  finished: text,
});

/** What arrives when a commitment falls due. It always offers a free way out. */
const commitmentDue = z.strictObject({
  from: text,
  subject: text,
  body: text,
  options: z.array(notificationOption).min(1),
});

/** How long until a commitment falls due, which is seeded. */
const wait = z.strictObject({
  min: z.number().int().positive(),
  max: z.number().int().positive(),
});

/** The player's word. There is no meter here: only a commitment and a memory. */
export const promises = z.strictObject({
  /** The seeded chance of being believed. */
  belief: z.strictObject({
    /** By who they are. */
    chance: perKind(z.number().min(0).max(1)),
    /** By what they make of the player. */
    mood: z.strictObject({
      warm: z.number(),
      neutral: z.number(),
      cold: z.number(),
    }),
    /** For each broken word that has reached them, and each kept one. */
    perBroken: z.number().nonnegative(),
    perKept: z.number().nonnegative(),
  }),
  /** What someone says back. Each says {who} and {what}. */
  replies: z.strictObject({
    believed: perKind(lines),
    /** Having nothing yet against the player, by who they are. */
    doubted: perKind(lines),
    /** Having been let down by the player themselves. */
    letDown: lines,
    /** Having heard of it. Says {victim} too, and {what} is what they heard of. */
    heard: lines,
  }),
  /** What a broken word does. Everyone tied to the victim hears at once. */
  broken: z.strictObject({
    about: id,
    /** What reached them, for the results screen. Says {victim} and {what}. */
    text,
    /** How much further the victim's belief falls, for each person tied to them. */
    perTie: z.number().int().nonnegative(),
  }),
  kept: z.strictObject({ about: id, text }),
  /** What the player's own list says of each. */
  statuses: z.strictObject({
    open: text,
    kept: text,
    broken: text,
    refused: text,
    lapsed: text,
  }),
  items: z.array(
    z.strictObject({
      id,
      to: id,
      title: text,
      /** The thing offered, which reads after "You told them". */
      what: text,
      after: wait,
      due: commitmentDue,
    }),
  ),
});

/** A trade worth only what the people in it can really deliver, on either side. */
export const deals = z.strictObject({
  /** Favours owed between Characters, dealt with the Power Map and never shown. */
  favours: z.strictObject({
    dealt: z.number().int().nonnegative(),
    /** Why one owes another. Says {owes} and {to}. */
    why: lines,
  }),
  /** How a favour reads. Each says {who} or {owes} and {to}, and {why}. */
  owed: z.strictObject({ youOwe: text, owesYou: text, between: text }),
  statuses: z.strictObject({
    open: text,
    kept: text,
    broken: text,
    refused: text,
    lapsed: text,
  }),
  items: z.array(
    z.strictObject({
      id,
      /** Who the player makes it with. */
      with: id,
      title: text,
      /** What the player offered, which reads after "You told them". */
      what: text,
      /** What they say as they shake on it. Says {who}. */
      agreed: text,
      /** Their side: a good word with someone, which only someone with sway can give. */
      word: z.strictObject({
        over: id,
        after: wait,
        /** The seeded chance they give it at all, by who they are. */
        chance: perKind(z.number().min(0).max(1)),
        /** How far it moves the belief of the one it is given to, if it lands. */
        shift: z.number().int().positive(),
        /** What the player is told. It is the same whether it lands or not. */
        given: notice,
        withheld: notice,
      }),
      /** When the player's side falls due, and what arrives then. */
      after: wait,
      due: commitmentDue,
      /** Why a favour is owed, if either side lets the other down. */
      owed: z.strictObject({ you: text, them: text }),
      /** What the results screen says the Deal was really worth. */
      worth: z.strictObject({
        landed: text,
        worthless: text,
        withheld: text,
        pending: text,
      }),
    }),
  ),
});

/** How a Believer burned enough changes, and what happens when someone leaves. */
export const changing = z.strictObject({
  /** How much burning it takes. */
  threshold: z.number().int().positive(),
  /** What burns someone: something done to them directly, which they remember. */
  burns: z.array(
    z.strictObject({
      /** The `about` of a memory, from news or `remembers`. */
      about: id,
      weight: z.number().int().positive(),
      /** What the results screen says was done. */
      why: text,
      /** Which way it leans them, relative to the other burns. */
      leans: z.strictObject({
        practitioner: z.number().nonnegative(),
        whistleblower: z.number().nonnegative(),
        left: z.number().nonnegative(),
      }),
    }),
  ),
  /** What the results screen calls each change. */
  became: z.strictObject({
    practitioner: text,
    whistleblower: text,
    left: text,
  }),
  whistleblower: z.strictObject({
    /** How much of what a whistleblower is seen doing is one of their own signs. */
    share: z.number().gt(0).lt(1),
    /** Shown beside what any Believer might show. Each says {who}. */
    signs: z.array(
      z.strictObject({
        id,
        text,
        clue: text.optional(),
        weight: z.number().positive(),
      }),
    ),
    /** Why a risk came out through them, for the results screen. Says {who}. */
    motive: text,
    /**
     * What they report. The first whose `when` holds goes ahead of any hidden risk,
     * and one with no `when` is sent only if no risk is waiting.
     */
    reports: z.array(z.strictObject({ when: condition.optional(), bill })),
  }),
  /** Who can leave, and what happens if they do. Anyone left out never leaves. */
  leaving: z.record(
    id,
    z.strictObject({
      /** What text calls whoever covers for them, in place of what it called them. */
      cover: text,
      notice,
      sets,
      project: projectChange,
    }),
  ),
});

/**
 * A visible, comic measure of the player's track record. It moves only when a
 * Thread plays out, and nothing but its Milestones reads it.
 */
export const gauge = z.strictObject({
  id,
  label: text,
  start: z.number().int(),
  min: z.number().int(),
  max: z.number().int(),
  /** A comic title, earned on reaching `at`. */
  milestones: z.array(
    z.strictObject({ at: z.number().int(), title: text, body: text }),
  ),
});

/**
 * How the player would fare on paper if a vacancy arose, from 0 to 100. It reads
 * only the official record: the flags named here, the Project's reported status
 * and a Final Warning. It decides nothing, and the player never sees its number.
 */
export const standing = z.strictObject({
  label: text,
  /** What the bar is, said beside it. */
  title: text,
  start: z.number().int().min(0).max(100),
  /** What each reported status of the Project adds, for as long as it stands. */
  reported: z.record(id, z.number().int()),
  /** The most it can be once the player is on a Final Warning. */
  finalWarning: z.number().int().min(0).max(100),
  /** Each from where it starts, in order from 0. */
  bands: z
    .array(
      z.strictObject({
        from: z.number().int().min(0).max(100),
        label: text,
        /** What the results screen says of ending in it. */
        onPaper: text,
      }),
    )
    .min(1),
  /** What each time a flag is set adds. Only flags the player's choices set in plain view. */
  deeds: z.array(z.strictObject({ flag: id, by: z.number().int() })),
  /** Who really holds influence over the boss's seat, at the end. Says {who}. */
  decides: text,
});
