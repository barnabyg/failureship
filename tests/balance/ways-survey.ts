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
 * Each `ways-*.test.ts` file plays some of the ways, so that workers share
 * them, and keeps its own tally: a file's tests read only the ways it plays.
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
export type StyleName = keyof typeof STYLES;

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

// What the ways this file plays have shown, over every run played so far.
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

/**
 * How often a way other than reading well or knowing may win: under a quarter
 * of the 0.40 cap on reading well in ways-reads-well.test.ts. Reading well wins
 * 39 of these deals, so this is close to the quarter of it the comparison used
 * when every way was in one file.
 */
export const FEW = 0.4 / 4;

/** The share of runs played this way that ended so. */
export const rate = (name: StyleName, of: keyof Omit<Tally, "runs">) => {
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

/**
 * Plays these ways of playing the whole climb, a quarter of the deals at a
 * time, each its own test, so that none runs long. The tests that `together`
 * declares read them all, and play any not yet played, as under `-t`. Every
 * run of every way must give a hint and finished text at every step, and a
 * real choice about an action every month.
 */
export function playsTheWholeClimb(
  title: string,
  names: readonly StyleName[],
  together: () => void,
) {
  const parts = names.flatMap((name) =>
    QUARTERS.map((_, q) => [name, q] as const),
  );
  describe(title, { timeout: 60_000 }, () => {
    it.each(parts)(
      "plays a quarter of the deals to the end: %s, %i",
      (name, q) => {
        playPart(name, q);

        expect(survey.get(name)?.runs).toBeGreaterThanOrEqual(25);
      },
    );

    describe("taken together", () => {
      beforeAll(() => {
        for (const [name, q] of parts) playPart(name, q);
      }, 600_000);

      it("gives a hint and finished text at every step, on every floor, of every run", () => {
        expect(problems.filter((p) => !p.endsWith("no real choice"))).toEqual(
          [],
        );
      });

      it("leaves a real choice about an action in every month, on every floor", () => {
        expect(problems.filter((p) => p.endsWith("no real choice"))).toEqual(
          [],
        );
      });

      together();
    });
  });
}

/** Every hint shown, over every run played in this file. */
export const hintsSeen = () => [...kindsSeen].sort();

/** Months played on each floor, over every run played in this file. */
export const monthsOnFloor = (job: string) => monthsOn.get(job) ?? 0;

/** Months played after a run's first demotion, over every run in this file. */
export const monthsAfterDemotion = () => monthsAfterADemotion;
