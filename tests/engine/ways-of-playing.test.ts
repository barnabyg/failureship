import { beforeAll, describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import type { PlayerView, Run } from "../../src/engine";
import { plainChoice } from "../../src/ui/later-month";
import {
  amoral,
  clicksAbout,
  guessesWhomToAsk,
  knowsThePowerMap,
  readsTheRoom,
} from "./players";
import {
  CLEAN,
  FAKED,
  FOR_REAL,
  FOR_SHOW,
  FOR_THE_SEAT,
  GET_RID,
  HONEST,
  REPORT,
  climb,
  type Otherwise,
} from "./real-runs";

/**
 * The balance of the whole climb, played through the real game, Company
 * Events and all, on the same deals in different ways. It counts how runs end
 * for each way of playing, and checks every step of every run on the way.
 */

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);
const JOBS = gameContent.floors.map((f) => f.job);

interface Style {
  once: string;
  always: readonly string[];
  otherwise?: (seed: number) => Otherwise;
}

/** Every way of playing checked, from a player who knows nothing to one with no scruples. */
const STYLES = {
  /** Files the report, goes to the meeting, and says the first thing. */
  plain: { once: "", always: [] },
  /** Fakes Floor 1's Plan, then does each Plan for real and asks above the boss for each seat. */
  planner: { once: CLEAN, always: [...FOR_REAL, ...FOR_THE_SEAT] },
  /** The same, with Floor 1's Plan done for real too. */
  honest: { once: HONEST, always: [...FOR_REAL, ...FOR_THE_SEAT] },
  /** Fakes Floor 1's Plan, then gets rid of each boss above it. */
  ridder: { once: CLEAN, always: [...GET_RID, ...FOR_THE_SEAT] },
  /** Gets rid of every boss, starting with the Speak Up line on Floor 1. */
  engineer: {
    once: `take-the-blame,${REPORT}`,
    always: [...GET_RID, ...FOR_THE_SEAT],
  },
  /** Fakes every Plan. */
  forShow: { once: CLEAN, always: [...FOR_SHOW, ...FOR_THE_SEAT] },
  /**
   * A climber with no scruples: fakes every Plan, gets rid of every boss, asks
   * above the boss for each seat, and otherwise takes the amoral choice each
   * time there is one: fabricate, attack or deflect.
   */
  amoral: {
    once: "",
    always: [FAKED, REPORT, ...FOR_SHOW, ...GET_RID, ...FOR_THE_SEAT],
    otherwise: () => amoral,
  },
  /** Clicks about. */
  random: { once: "", always: [], otherwise: clicksAbout },
} satisfies Record<string, Style>;
type StyleName = keyof typeof STYLES;

interface Tally {
  runs: number;
  won: number;
  passedOver: number;
  demoted: number;
  fired: number;
}

/** Whatever on a step a player cannot act on: a missing hint, or unfinished text. */
function problemsWith(view: PlayerView): string[] {
  const shown = JSON.stringify(view);
  return [
    ...(view.hint.trim() === "" ? ["no hint"] : []),
    ...(shown.match(/\{[a-zA-Z]+\}/g) ?? []),
    ...(shown.match(/\b(TODO|TBD|FIXME|XXX|lorem|ipsum|placeholder)\b/gi) ??
      []),
  ];
}

/**
 * Whether the player had a real choice about at least one action this month:
 * a place on the floor to pick with an action left, or an answer that costs
 * one beside one that does not.
 */
function aChoiceAbout(views: readonly PlayerView[]): boolean {
  return views.some(({ step, choices, actions }) =>
    step.kind === "actions"
      ? actions.remaining > 0 &&
        choices.filter((c) => c.type === "action").length >= 2
      : step.kind === "notification" &&
        step.options.some(
          (o) => o.affordable && o.costLabel !== gameContent.ui.freeLabel,
        ) &&
        step.options.some((o) => o.costLabel === gameContent.ui.freeLabel),
  );
}

const survey = new Map<StyleName, Tally>();
const problems: string[] = [];
const kindsSeen = new Set<string>();
const monthsOn = new Map<string, number>();
let monthsAfterADemotion = 0;

/** Plays a whole run, and keeps what the tests read of it. */
function play(seed: number, name: StyleName, style: Style) {
  const { truth, views } = climb(seed, style.once, style.always, gameContent, {
    otherwise: style.otherwise?.(seed),
  });
  const end = views.at(-1)?.step;
  if (end?.kind !== "results")
    throw new Error(`${name} ${String(seed)}: no results`);
  const owner = `${name} seed ${String(seed)}`;
  let demotedIn: number | null = null;
  for (const [i, view] of views.entries()) {
    kindsSeen.add(view.step.kind);
    for (const problem of problemsWith(view)) {
      problems.push(
        `${owner} month ${String(view.month)} ${view.step.kind}: ${problem}`,
      );
    }
    const before = views[i - 1];
    if (before && JOBS.indexOf(view.job.id) < JOBS.indexOf(before.job.id)) {
      demotedIn ??= view.month;
    }
  }
  for (let month = 1; month <= (views.at(-2)?.month ?? 0); month++) {
    const ofMonth = views.filter((v) => v.month === month);
    const job = ofMonth[0]?.job.id ?? "";
    monthsOn.set(job, (monthsOn.get(job) ?? 0) + 1);
    if (demotedIn !== null && month > demotedIn) monthsAfterADemotion += 1;
    if (!aChoiceAbout(ofMonth)) {
      problems.push(
        `${owner} month ${String(month)} on ${job}: no real choice`,
      );
    }
  }
  const tally = survey.get(name) ?? {
    runs: 0,
    won: 0,
    passedOver: 0,
    demoted: 0,
    fired: 0,
  };
  tally.runs += 1;
  if (end.ending.won) tally.won += 1;
  if (end.ending.fired) tally.fired += 1;
  if (demotedIn !== null) tally.demoted += 1;
  if (
    truth.vacancies.some(
      (v) =>
        v.decided !== null &&
        v.decided.winner !== "you" &&
        v.decided.candidates.some((c) => c.who === "you"),
    )
  ) {
    tally.passedOver += 1;
  }
  survey.set(name, tally);
}

const rate = (name: StyleName, of: keyof Omit<Tally, "runs">) => {
  const tally = survey.get(name);
  return tally ? tally[of] / tally.runs : NaN;
};

// Eight ways of playing a hundred deals take most of a minute.
describe("ways of playing the whole climb", { timeout: 180_000 }, () => {
  beforeAll(() => {
    for (const [name, style] of Object.entries(STYLES)) {
      for (const seed of SEEDS) play(seed, name as StyleName, style);
    }
  }, 180_000);

  // Of these 100 deals, the planner wins 30, honest play 12 and faking every
  // Plan 11, getting rid of bosses 3 and getting rid of every boss 2. They
  // know every option, so a person will likely win less.
  it("reaches the win by at least two different ways of playing, and less often for show", () => {
    expect(rate("planner", "won")).toBeGreaterThanOrEqual(0.15);
    expect(rate("honest", "won")).toBeGreaterThanOrEqual(0.05);
    expect(rate("forShow", "won")).toBeGreaterThan(0);
    expect(rate("forShow", "won")).toBeLessThan(rate("planner", "won"));
    expect(rate("ridder", "won") + rate("engineer", "won")).toBeGreaterThan(0);
  });

  // Of these 100 deals, the amoral climber wins 1 and is fired on 89.
  it("does not take a climber who makes the amoral choice each time to the top", () => {
    expect(rate("amoral", "won")).toBeLessThan(rate("honest", "won") / 2);
    expect(rate("amoral", "won")).toBeLessThan(rate("planner", "won") / 4);
    expect(rate("amoral", "fired")).toBeGreaterThan(0.5);
  });

  // Plain play never wins on these deals, which is a finding for the owner and
  // not a rule: what should hold is that a climber does better.
  it("does not fire a player who only plays plainly, nor take them as far as a climber", () => {
    expect(rate("plain", "fired")).toBe(0);
    expect(rate("plain", "won")).toBeLessThan(rate("planner", "won"));
    expect(rate("plain", "won")).toBeLessThan(rate("honest", "won"));
    expect(rate("plain", "passedOver")).toBeGreaterThan(0);
  });

  // Doing the Plans, for real or for show, never demotes or fires on these 100
  // deals. Getting rid of bosses is traced, and demotes on 9, or 20 for
  // getting rid of every boss.
  it("demotes the players who get rid of their bosses, and rarely fires those who do the Plans", () => {
    for (const careful of ["planner", "honest", "forShow"] as const) {
      expect(rate(careful, "fired")).toBeLessThanOrEqual(0.02);
      expect(rate(careful, "demoted")).toBeLessThan(rate("ridder", "demoted"));
    }
    expect(rate("engineer", "demoted")).toBeGreaterThan(0.05);
    for (const name of Object.keys(STYLES) as StyleName[]) {
      if (name !== "plain")
        expect(rate(name, "passedOver"), name).toBeGreaterThan(0);
    }
  });

  it("gives a hint and finished text at every step, on every floor, of every run", () => {
    expect(problems.filter((p) => !p.endsWith("no real choice"))).toEqual([]);
    // Every step there is a hint for, from a Notification to the win.
    expect([...kindsSeen].sort()).toEqual(
      Object.keys(gameContent.ui.hints).sort(),
    );
  });

  it("leaves a real choice about an action in every month, on every floor, and after a demotion", () => {
    expect(problems.filter((p) => p.endsWith("no real choice"))).toEqual([]);
    for (const { job } of gameContent.floors) {
      expect(monthsOn.get(job) ?? 0, job).toBeGreaterThan(100);
    }
    expect(monthsAfterADemotion).toBeGreaterThan(50);
  });
});

/** Seats won, of those the player stood for, and runs won, by how they pick whom to ask. */
function asking(
  pick: (seed: number) => {
    otherwise: Otherwise;
    watch?: (view: PlayerView, run: Run) => void;
  },
) {
  let won = 0;
  let stood = 0;
  let runsWon = 0;
  for (const seed of SEEDS) {
    const { truth, views } = climb(
      seed,
      CLEAN,
      FOR_REAL,
      gameContent,
      pick(seed),
    );
    const decided = truth.vacancies.filter((v) =>
      v.decided?.candidates.some((c) => c.who === "you"),
    );
    stood += decided.length;
    won += decided.filter((v) => v.decided?.winner === "you").length;
    const end = views.at(-1)?.step;
    if (end?.kind === "results" && end.ending.won) runsWon += 1;
  }
  return { seats: won / stood, runsWon };
}

// Whoever really holds influence over a seat decides it, and a word with
// them, or with someone they listen to, counts. So the climb still pays a
// player who reads people. Of these 100 deals: 73.0% of seats for whoever
// knows the Power Map, 71.8% for a reader of the room, 66.5% for a guess, and
// 56.3% for leaving it to the process; and 48, 44, 36 and 24 runs won. The
// deals are fixed, so the narrow lead of knowing over reading cannot flake.
describe("reading people on the way up", { timeout: 120_000 }, () => {
  it("wins more seats for a careful reader of the room than for a guess", () => {
    const leaving = asking(() => ({ otherwise: plainChoice }));
    const guessing = asking((seed) => ({ otherwise: guessesWhomToAsk(seed) }));
    const reading = asking(() => readsTheRoom());
    const knowing = asking(() => ({ otherwise: knowsThePowerMap }));

    expect(reading.seats).toBeGreaterThan(guessing.seats);
    expect(reading.runsWon).toBeGreaterThan(guessing.runsWon);
    expect(guessing.seats).toBeGreaterThan(leaving.seats);
    expect(knowing.seats).toBeGreaterThanOrEqual(reading.seats);
  }, 120_000);
});
