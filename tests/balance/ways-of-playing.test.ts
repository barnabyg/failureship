import { beforeAll, describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import type { PlayerView, Run } from "../../src/engine";
import {
  amoralBlind,
  amoralKnowing,
  clicksAbout,
  readsWell,
} from "../engine/players";
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
} from "../engine/real-runs";

/**
 * The balance of the whole climb, played through the real game, Company
 * Events and all, on the same deals in different ways. It counts how runs end
 * for each way of playing, and checks every step of every run on the way.
 */

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);
/** The deals in quarters, each played in its own test, so that none runs long. */
const QUARTERS = [0, 1, 2, 3].map((q) => SEEDS.slice(q * 25, q * 25 + 25));
const JOBS = gameContent.floors.map((f) => f.job);

interface Style {
  once: string;
  always: readonly string[];
  /** How it chooses otherwise, and what it watches as it plays, for each deal. */
  player?: (seed: number) => {
    otherwise: Otherwise;
    watch?: (view: PlayerView, run: Run) => void;
  };
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
   * The winning way: mostly amoral, reading well from the player view, about
   * three times in four, and holding back where the consequence is plain.
   */
  readsWell: { once: "", always: [], player: () => readsWell() },
  /**
   * A climber with no scruples: fakes every Plan, gets rid of every boss, asks
   * above the boss for each seat, and otherwise takes the amoral choice each
   * time there is one: fabricate, attack or deflect. Offered a way out, it
   * picks one at random.
   */
  amoral: {
    once: "",
    always: [FAKED, REPORT, ...FOR_SHOW, ...GET_RID, ...FOR_THE_SEAT],
    player: (seed) => ({ otherwise: amoralBlind(seed) }),
  },
  /** The same, with the hidden truth: the ceiling of amoral play. */
  knowing: {
    once: "",
    always: [FAKED, REPORT, ...FOR_SHOW, ...GET_RID],
    player: () => ({ otherwise: amoralKnowing }),
  },
  /** Clicks about. */
  random: {
    once: "",
    always: [],
    player: (seed) => ({ otherwise: clicksAbout(seed) }),
  },
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
 * Which hint the step has: on the floor with something in the inbox to answer,
 * the inbox's, by whether a place on the floor can still be taken.
 */
function hintOf(view: PlayerView): string {
  const { step, waiting, choices } = view;
  if (waiting || step.kind === "actions") return step.kind;
  return choices.some((c) => c.type === "action") ? "inbox" : "inboxOnly";
}

/**
 * Whether the player had a real choice about at least one action this month:
 * a place on the floor to pick with an action left, or an answer that costs
 * one beside one that does not.
 */
function aChoiceAbout(views: readonly PlayerView[]): boolean {
  return views.some(
    ({ step, choices, actions }) =>
      (actions.remaining > 0 &&
        choices.filter((c) => c.type === "action").length >= 2) ||
      (step.kind === "notification" &&
        step.options.some(
          (o) => o.affordable && o.costLabel !== gameContent.ui.freeLabel,
        ) &&
        step.options.some((o) => o.costLabel === gameContent.ui.freeLabel)),
  );
}

const survey = new Map<StyleName, Tally>();
const problems: string[] = [];
const kindsSeen = new Set<string>();
const monthsOn = new Map<string, number>();
let monthsAfterADemotion = 0;

/** Plays a whole run, and keeps what the tests read of it. */
function play(seed: number, name: StyleName, style: Style) {
  const { truth, views } = climb(
    seed,
    style.once,
    style.always,
    gameContent,
    style.player?.(seed),
  );
  const end = views.at(-1)?.step;
  if (end?.kind !== "results")
    throw new Error(`${name} ${String(seed)}: no results`);
  const owner = `${name} seed ${String(seed)}`;
  let demotedIn: number | null = null;
  for (const [i, view] of views.entries()) {
    kindsSeen.add(hintOf(view));
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

const played = new Set<string>();

/** Plays a quarter of the deals in this way, once. */
function playPart(name: StyleName, q: number) {
  const key = `${name} ${String(q)}`;
  if (played.has(key)) return;
  for (const seed of QUARTERS[q] ?? []) play(seed, name, STYLES[name]);
  played.add(key);
}

const NAMES = Object.keys(STYLES) as StyleName[];
const PARTS = NAMES.flatMap((name) =>
  QUARTERS.map((_, q) => [name, q] as const),
);

// Each way of playing is played a quarter of the deals at a time, each its own
// test, so that none runs long. The tests after read them all, and play any
// not yet played.
describe("ways of playing the whole climb", { timeout: 60_000 }, () => {
  it.each(PARTS)(
    "plays a quarter of the deals to the end: %s, %i",
    (name, q) => {
      playPart(name, q);

      expect(survey.get(name)?.runs).toBeGreaterThanOrEqual(25);
    },
  );

  describe("taken together", () => {
    beforeAll(() => {
      for (const [name, q] of PARTS) playPart(name, q);
    }, 600_000);

    // Of these 100 deals, reading well and mostly amoral wins 39, and the
    // amoral ceiling, which knows the hidden truth, 42. A person will likely
    // win less.
    it("takes a mostly amoral player who reads well to the top most often, short of the ceiling", () => {
      expect(rate("readsWell", "won")).toBeGreaterThanOrEqual(0.25);
      expect(rate("readsWell", "won")).toBeLessThanOrEqual(0.4);
      for (const name of NAMES) {
        if (name !== "readsWell" && name !== "knowing")
          expect(rate(name, "won"), name).toBeLessThan(
            rate("readsWell", "won") / 4,
          );
      }
      expect(rate("knowing", "won")).toBeGreaterThanOrEqual(
        rate("readsWell", "won"),
      );
      expect(rate("knowing", "fired")).toBe(0);
    });

    // There is no route to the top without bad behaviour: honest play wins 3,
    // the planner, who fakes only Floor 1's Plan, 5, and plain play none.
    it("takes nobody to the top without bad behaviour more than a handful of times", () => {
      expect(rate("honest", "won")).toBeLessThanOrEqual(0.03);
      expect(rate("planner", "won")).toBeLessThanOrEqual(0.05);
      expect(rate("plain", "won")).toBeLessThanOrEqual(0.03);
    });

    // Of these 100 deals, the amoral climber who picks its ways out at random
    // wins 4 and is fired on 71.
    it("fires an always amoral climber who picks its ways out blindly, and rarely takes it to the top", () => {
      expect(rate("amoral", "won")).toBeLessThanOrEqual(0.05);
      expect(rate("amoral", "fired")).toBeGreaterThan(0.5);
    });

    it("never fires a player who only plays plainly", () => {
      expect(rate("plain", "fired")).toBe(0);
      for (const name of NAMES) {
        if (name !== "plain")
          expect(rate(name, "passedOver"), name).toBeGreaterThan(0);
      }
    });

    // Doing the Plans, for real or for show, never fires on these deals. A
    // big mistake demotes the reader on 8, who climbs back by not making it
    // again.
    it("rarely fires those who do the Plans, and demotes after a big mistake", () => {
      for (const careful of ["planner", "honest", "forShow"] as const) {
        expect(rate(careful, "fired")).toBeLessThanOrEqual(0.02);
      }
      expect(rate("readsWell", "demoted")).toBeGreaterThan(0.05);
      expect(rate("readsWell", "fired")).toBeLessThan(0.1);
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
});
