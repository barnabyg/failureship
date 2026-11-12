import { gameContent } from "../../src/content";
import {
  resumeRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { everyBill, everyNotification } from "../../src/engine/content";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { calledBy } from "../../src/engine/say";
import type { State } from "../../src/engine/state";
import { plainChoice } from "../../src/ui/later-month";
import {
  FAKED,
  FOR_REAL,
  FOR_SHOW,
  FOR_THE_SEAT,
  type Otherwise,
} from "./real-runs";
import { everySign } from "./scene-view";

/**
 * Scripted players for the balance tests, each a way of choosing whatever a
 * climber's script leaves open: on principle, at random, or by reading people.
 */

const notifications = everyNotification(gameContent);

/** The family of Move a choice is, as written in the data, if it has one. */
function familyOf(choice: Choice): string | undefined {
  if (choice.type === "notification") {
    return notifications
      .find((n) => n.id === choice.notificationId)
      ?.options.find((o) => o.id === choice.optionId)?.family;
  }
  if (choice.type === "scene") {
    return gameContent.scenes
      .find((s) => s.id === choice.sceneId)
      ?.options.find((o) => o.id === choice.optionId)?.family;
  }
  return undefined;
}

/** The families a player without scruples reaches for, first choice first. */
const AMORAL = ["fabricate", "attack", "deflect"];

/** The Escapes a player without scruples reaches for, first choice first. */
const ESCAPING = ["blame", "lie", "bury"];

/** The kind of Escape a choice is, as written in the data. */
function escapeKindOf(choice: Choice): string | undefined {
  if (choice.type !== "escape") return undefined;
  return everyBill(gameContent)
    .find((b) => b.id === choice.billId)
    ?.escapes.find((e) => e.id === choice.escapeId)?.kind;
}

/**
 * Takes the amoral choice each time there is one, and plays plainly otherwise.
 * Offered a way out, they blame someone, lie or bury it, before taking it.
 */
export const amoral: Otherwise = (view) => {
  const escape = view.choices
    .map((choice) => ({
      choice,
      at: ESCAPING.indexOf(escapeKindOf(choice) ?? ""),
    }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at)[0];
  if (escape) return escape.choice;
  const ranked = view.choices
    .map((choice) => ({ choice, at: AMORAL.indexOf(familyOf(choice) ?? "") }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at);
  return ranked[0]?.choice ?? plainChoice(view);
};

/** Clicks about: whatever is on offer, by a fixed rule from the seed and the step. */
export function clicksAbout(seed: number): Otherwise {
  let turn = 0;
  return (view) => {
    turn += 1;
    return (
      view.choices[(seed * 7 + turn * 3) % view.choices.length] ??
      plainChoice(view)
    );
  };
}

const byName = new Map(gameContent.characters.map((c) => [c.name, c.id]));

/** Whom a choice has a word with about an open seat, if anyone. */
function approachedBy(view: PlayerView, choice: Choice): string | undefined {
  if (choice.type !== "notification") return undefined;
  const approach = notifications
    .find((n) => n.id === choice.notificationId)
    ?.options.find((o) => o.id === choice.optionId)?.seat?.approach;
  // Your boss's boss is whoever the Org Chart says, as the player reads it.
  if (approach === "{head}") {
    const head = view.orgChart.find((e) =>
      e.title.endsWith("your boss's boss"),
    );
    return head ? byName.get(head.name) : undefined;
  }
  return approach;
}

/** The words with someone about the seat that this step offers. */
const approaches = (view: PlayerView) =>
  view.choices.filter((c) => approachedBy(view, c) !== undefined);

/** Has a word about each open seat with one of those on offer, picked at random. */
export function guessesWhomToAsk(seed: number): Otherwise {
  let turn = 0;
  return (view) => {
    turn += 1;
    const open = approaches(view);
    return (
      open[(seed * 13 + turn) % Math.max(open.length, 1)] ?? plainChoice(view)
    );
  };
}

/** Has a word about each open seat with whoever really decides it, or their sway. */
export const knowsThePowerMap: Otherwise = (view, run) => {
  const truth = readHiddenTruth(run);
  const seat = truth.vacancies.find((v) => v.decided === null);
  const decider = seat ? (seat.patron ?? seat.holder) : undefined;
  const sways = (who: string | undefined) =>
    who === decider ||
    truth.powerMap.influence.some((i) => i.who === who && i.over === decider);
  return (
    approaches(view).find((c) => sways(approachedBy(view, c))) ??
    plainChoice(view)
  );
};

const escaped = (text: string) => text.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

/** Each Scene's signs, as patterns that give back who was put in each part. */
const signs = new Map(
  gameContent.scenes.map((scene) => [
    scene.id,
    scene.signs.map(({ text }) => {
      const parts: string[] = [];
      const pattern = escaped(text).replace(
        /\{(holder|ignored|bystander)\}/g,
        (_, part: string) => {
          parts.push(part);
          return "(.+?)";
        },
      );
      return { pattern: new RegExp(`^${pattern}$`, "i"), parts };
    }),
  ]),
);

/** How much each part of a sign says about someone's standing in the room. */
const STANDING: Record<string, number> = {
  holder: 2,
  bystander: 1,
  ignored: -2,
};

/**
 * A careful reader of the room, who keeps a tally of who holds the floor in
 * every Scene's signs, and has a word about each open seat with whoever has
 * held it most. It reads the signs as shown. To tell who a sign's words, such
 * as "your boss", mean, it parses `run.save()` for `calledBy`, which gives the
 * same words the screen uses, and reads nothing else of the save.
 */
export function readsTheRoom() {
  const tally = new Map<string, number>();
  const watch = (view: PlayerView, run: Run) => {
    const { step } = view;
    if (step.kind !== "scene") return;
    const { state } = JSON.parse(run.save()) as { state: State };
    const called = new Map(
      gameContent.characters.map((c) => [
        calledBy(state, gameContent, c.id).toLowerCase(),
        c.id,
      ]),
    );
    for (const { text } of everySign(step)) {
      for (const { pattern, parts } of signs.get(step.id) ?? []) {
        const found = pattern.exec(text);
        if (!found) continue;
        parts.forEach((part, i) => {
          const who = called.get(found[i + 1]?.toLowerCase() ?? "");
          if (who)
            tally.set(who, (tally.get(who) ?? 0) + (STANDING[part] ?? 0));
        });
        break;
      }
    }
  };
  const standing = (view: PlayerView, choice: Choice) =>
    tally.get(approachedBy(view, choice) ?? "") ?? 0;
  const otherwise: Otherwise = (view) =>
    approaches(view).sort((a, b) => standing(view, b) - standing(view, a))[0] ??
    plainChoice(view);
  return { otherwise, watch };
}

/** Whether an Escape works, by trying it on a copy of the run. */
function worksOnACopy(run: Run, choice: Choice): boolean {
  if (choice.type !== "escape") return false;
  const copy = resumeRun({ save: run.save(), content: gameContent });
  copy.choose(choice);
  const { state } = JSON.parse(copy.save()) as { state: State };
  return state.escapes.at(-1)?.worked ?? false;
}

const escapesIn = (view: PlayerView) =>
  view.choices.filter(
    (c) => escapeKindOf(c) !== undefined && escapeKindOf(c) !== "take",
  );
const takeIt = (view: PlayerView) =>
  view.choices.find((c) => escapeKindOf(c) === "take");

/** Always amoral, and offered a way out, picks one of them at random, never taking it. */
export function amoralBlind(seed: number): Otherwise {
  let turn = 0;
  return (view, run) => {
    const ways = escapesIn(view);
    if (ways.length > 0) {
      turn += 1;
      return ways[(seed * 11 + turn * 5) % ways.length] ?? plainChoice(view);
    }
    return amoral(view, run);
  };
}

/** The options written with a big mistake among what they can lead to. */
const canBeAMistake = new Set(
  [...gameContent.scenes, ...notifications].flatMap((written) =>
    written.options
      .filter((o) => JSON.stringify(o).includes('"mistake"'))
      .map((o) => `${written.id}:${o.id}`),
  ),
);

/** How many big mistakes a choice adds at once, by trying it on a copy of the run. */
function mistakesOnACopy(run: Run, choice: Choice): number {
  const key =
    choice.type === "scene"
      ? `${choice.sceneId}:${choice.optionId}`
      : choice.type === "notification"
        ? `${choice.notificationId}:${choice.optionId}`
        : "";
  if (!canBeAMistake.has(key)) return 0;
  const before = (JSON.parse(run.save()) as { state: State }).state.mistakes
    .length;
  const copy = resumeRun({ save: run.save(), content: gameContent });
  copy.choose(choice);
  const { state } = JSON.parse(copy.save()) as { state: State };
  return state.mistakes.length - before;
}

/** The amoral choices on offer, first choice first. */
const amoralChoices = (view: PlayerView) =>
  view.choices
    .map((choice) => ({ choice, at: AMORAL.indexOf(familyOf(choice) ?? "") }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at)
    .map(({ choice }) => choice);

/**
 * Always amoral, with the hidden truth, as the ceiling. Offered a way out, it
 * tries each on a copy of the run and takes one that works, naming whoever has
 * least influence, or takes it if none does. It takes every amoral choice but
 * one that is a big mistake there and then, which no way out can undo, and
 * has a word about each open seat with whoever really decides it.
 */
export const amoralKnowing: Otherwise = (view, run) => {
  // Whoever a choice names, the less influence they have the better.
  const leastHarm = (choices: Choice[]) => {
    if (choices.length < 2) return choices[0];
    const { order } = readHiddenTruth(run).powerMap;
    const state = stateOf(run);
    const harmless = (c: Choice) =>
      Math.min(
        order.length,
        ...namedIn(state, labelOf(view, c)).map((id) =>
          order.includes(id) ? order.indexOf(id) : order.length,
        ),
      );
    return choices.sort((a, b) => harmless(b) - harmless(a))[0];
  };
  const ways = escapesIn(view);
  if (ways.length > 0) {
    return (
      leastHarm(ways.filter((c) => worksOnACopy(run, c))) ??
      takeIt(view) ??
      plainChoice(view)
    );
  }
  if (approaches(view).length > 0) return knowsThePowerMap(view, run);
  return (
    leastHarm(
      amoralChoices(view).filter((c) => mistakesOnACopy(run, c) === 0),
    ) ?? plainChoice(view)
  );
};

/** The run's state, read from its save, for the words the screen uses. */
const stateOf = (run: Run) =>
  (JSON.parse(run.save()) as { state: State }).state;

/** Whom a label names, by what the player calls them. */
function namedIn(state: State, label: string): string[] {
  const lower = label.toLowerCase();
  return gameContent.characters
    .filter((c) =>
      lower.includes(calledBy(state, gameContent, c.id).toLowerCase()),
    )
    .map((c) => c.id);
}

/** What a choice says, as the player reads it. */
function labelOf(view: PlayerView, choice: Choice): string {
  const { step } = view;
  if (choice.type === "scene" && step.kind === "scene")
    return step.options.find((o) => o.id === choice.optionId)?.label ?? "";
  if (choice.type === "notification" && step.kind === "notification")
    return step.options.find((o) => o.id === choice.optionId)?.label ?? "";
  if (choice.type === "escape" && step.kind === "escape")
    return step.escapes.find((e) => e.id === choice.escapeId)?.label ?? "";
  return "";
}

const KIND_NAMES: readonly string[] = [
  "believer",
  "incompetent",
  "practitioner",
];

/**
 * Every line written for how a boss of each kind takes something, as a
 * pattern, with the kind it is written for. A player who knows the game knows
 * what each kind of boss tends to say, but not that a sign can mislead.
 */
const reactions: { pattern: RegExp; kind: string }[] = [];
(function collect(node: unknown) {
  if (Array.isArray(node)) {
    node.forEach(collect);
    return;
  }
  if (node === null || typeof node !== "object") return;
  const entries = Object.entries(node);
  const byKind =
    entries.length > 0 &&
    entries.every(([k, v]) => KIND_NAMES.includes(k) && typeof v === "string");
  if (byKind) {
    for (const [kind, text] of entries) {
      const pattern = escaped(text as string).replace(
        /\\?\{[a-zA-Z]+\\?\}/g,
        ".+?",
      );
      reactions.push({ pattern: new RegExp(`^${pattern}$`, "i"), kind });
    }
    return;
  }
  entries.forEach(([, v]) => {
    collect(v);
  });
})(gameContent);

/** The patterns of what someone might be told of a dangerous Hidden Fact. */
const dangerous = gameContent.hiddenTruth.facts
  .filter((f) => f.nature === "dangerous")
  .flatMap((f) => [f.told ?? f.text, f.text])
  .map(
    (text) => new RegExp(escaped(text).replace(/\\?\{name\\?\}/g, ".+?"), "i"),
  );

/** The ids of the options that do the Plans for real, and for show. */
const PLAN_REAL = new Set(FOR_REAL);
const PLAN_SHOW = new Set([FAKED, ...FOR_SHOW]);
const SEAT_WORDS = new Set(FOR_THE_SEAT);

/** Every Escape, by its id, as written. */
const escapeById = new Map(
  everyBill(gameContent).flatMap((b) => b.escapes.map((e) => [e.id, e])),
);

/** The places on each floor where a player can find out, best for Hidden Facts first. */
const FIND_OUT = gameContent.actions
  .filter((a) => a.findOut !== undefined)
  .sort((a, b) => Number(b.findOut === "buy") - Number(a.findOut === "buy"))
  .map((a) => a.id);

/** Whether an Escape is written as an explicit bet. */
function isABet(id: string): boolean {
  const escape = escapeById.get(id);
  return (
    escape !== undefined && "chance" in escape && escape.chance !== undefined
  );
}

/**
 * Mostly amoral, reading well, from the player view only: the signs, the
 * Notebook, and the words the screen uses for people. It buys what people know
 * once a month, about colleagues first. It fakes each Grand Plan unless its
 * boss's reactions read as a Believer's, and then does it for real. It has a
 * word about each open seat with whoever the signs show holding the room.
 * Otherwise it takes the amoral choice, about three times in four, and holds
 * back where the consequence is plain: an attack on nobody in particular or on
 * someone it has not found out about, blaming someone the Notebook says is
 * dangerous, faking in front of a boss who reads as a Believer, and anything
 * but faking on a Final Warning. Offered a way out, it does not blame anyone
 * it has not found out about or who reads as dangerous, nor lie to a boss who
 * reads as a Believer, and would rather a sure way than a bet; with no way out
 * that reads safe, it takes it.
 */
export function readsWell() {
  const room = readsTheRoom();
  const kindTally = new Map<string, Map<string, number>>();
  const seen = new Set<string>();
  const asked = new Set<string>();
  let foundOutIn = 0;
  let state: State | null = null;
  const bossOf = () => {
    const now = state;
    return now
      ? gameContent.characters.find(
          (c) => calledBy(now, gameContent, c.id).toLowerCase() === "your boss",
        )?.id
      : undefined;
  };
  const watch = (view: PlayerView, run: Run) => {
    room.watch(view, run);
    state = (JSON.parse(run.save()) as { state: State }).state;
    const boss = bossOf();
    if (!boss) return;
    const texts: string[] = [];
    (function find(node: unknown) {
      if (Array.isArray(node)) node.forEach(find);
      else if (node !== null && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) {
          if (k === "reaction" && typeof v === "string") texts.push(v);
          else find(v);
        }
      }
    })({ step: view.step, result: view.result });
    for (const text of texts) {
      const key = `${String(view.month)}:${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const kind = reactions.find((r) => r.pattern.test(text))?.kind;
      if (!kind) continue;
      const tally = kindTally.get(boss) ?? new Map<string, number>();
      tally.set(kind, (tally.get(kind) ?? 0) + 1);
      kindTally.set(boss, tally);
    }
  };
  /** Whether the boss's reactions so far read most like a Believer's. */
  const bossReadsBeliever = () => {
    const tally = kindTally.get(bossOf() ?? "");
    if (!tally) return false;
    const best = [...tally].sort((a, b) => b[1] - a[1])[0];
    return best?.[0] === "believer";
  };
  /** Whom the Notebook says has a dangerous Hidden Fact. */
  const dangerousPeople = (view: PlayerView) =>
    new Set(
      view.notebook.clues
        .filter((c) => dangerous.some((d) => d.test(c.text)))
        .flatMap((c) => c.about)
        .map((name) => byName.get(name) ?? name),
    );
  /**
   * Whether a label names nobody the player has found out about, or someone
   * the Notebook says is dangerous: a consequence it cannot read.
   */
  const unreadable = (view: PlayerView, label: string) => {
    const risky = dangerousPeople(view);
    const who = state === null ? [] : namedIn(state, label);
    return who.some((id) => risky.has(id) || !asked.has(id));
  };
  const otherwise: Otherwise = (view, run) => {
    const ways = escapesIn(view);
    if (ways.length > 0) {
      const safe = ways.filter((c) => {
        if (c.type !== "escape") return false;
        const escape = escapeById.get(c.escapeId);
        if (!escape) return false;
        if (escape.kind === "lie" && bossReadsBeliever()) return false;
        if (escape.kind === "blame" && unreadable(view, escape.label))
          return false;
        return true;
      });
      const sure = safe.filter(
        (c) => c.type === "escape" && !isABet(c.escapeId),
      );
      return sure[0] ?? safe[0] ?? takeIt(view) ?? plainChoice(view);
    }
    // Colleagues first: they are whom a climber blames.
    const above = (c: Choice) =>
      c.type === "find-out" && state !== null
        ? Number(calledBy(state, gameContent, c.subjectId).includes("boss"))
        : 0;
    const askAbout = view.choices
      .filter(
        (c) =>
          c.type === "find-out" &&
          c.subjectId !== c.sourceId &&
          !asked.has(c.subjectId),
      )
      .sort((a, b) => above(a) - above(b));
    const anyone = view.choices.find((c) => c.type === "find-out");
    if (askAbout[0] ?? anyone) {
      const choice = askAbout[0] ?? anyone;
      if (choice?.type === "find-out") asked.add(choice.subjectId);
      return choice ?? plainChoice(view);
    }
    const meeting = view.choices.find(
      (c) => c.type === "action" && c.actionId.startsWith("meeting"),
    );
    const findOut = view.choices.find(
      (c) =>
        c.type === "action" &&
        c.actionId ===
          FIND_OUT.find((f) =>
            view.choices.some((x) => x.type === "action" && x.actionId === f),
          ),
    );
    if (!meeting && findOut && foundOutIn !== view.month) {
      foundOutIn = view.month;
      return findOut;
    }
    const id = (c: Choice) => ("optionId" in c ? c.optionId : "");
    const plan = view.choices.find((c) =>
      bossReadsBeliever() ? PLAN_REAL.has(id(c)) : PLAN_SHOW.has(id(c)),
    );
    if (plan) return plan;
    if (
      view.choices.some((c) => SEAT_WORDS.has(id(c)) || approachedBy(view, c))
    )
      return room.otherwise(view, run);
    const held = (c: Choice) => {
      const label = labelOf(view, c);
      const who = state === null ? [] : namedIn(state, label);
      // On a Final Warning, only what can be got out of afterwards.
      if (view.finalWarning && familyOf(c) !== "fabricate") return true;
      switch (familyOf(c)) {
        case "attack":
          return who.length === 0 || unreadable(view, label);
        case "deflect":
          return who.some((x) => dangerousPeople(view).has(x));
        default:
          return bossReadsBeliever();
      }
    };
    const amoralOne = amoralChoices(view).find((c) => !held(c));
    if (amoralOne) return amoralOne;
    return plainChoice(view);
  };
  return { otherwise, watch };
}
