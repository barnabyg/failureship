import { expect } from "vitest";
import { gameContent } from "../../src/content";
import {
  startRun,
  type Choice,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice, playToMonth } from "../../src/ui/later-month";

/** Fakes the Plan at month 5's Ideas Workshop, which a boss who is not a Believer counts. */
export const FAKED = "screenshot-on-the-note";

/**
 * Takes the blame in month 2's Lessons Learned Review, which keeps the record
 * clean, and fakes the Plan: on seeds 2 and 16 the seat is yours, and Floor 2
 * starts in month 8.
 */
export const CLEAN = `take-the-blame,${FAKED}`;

/**
 * Floor 2's Grand Plan done for real in its second month, and Floor 3's in its
 * own: on seed 2 that wins three seats, as months 7, 11 and 15 close.
 */
export const CLIMB = `${CLEAN},staff-the-centre,decide-what-stops`;

/** A whole run of the real game, played as the browser tests' helpers play. */
export interface Played {
  run: Run;
  /** Every view, from the month played from to the end. */
  views: PlayerView[];
  /** The month each option named was taken in. */
  took: Map<string, number>;
}

/**
 * Plays the real game plainly, as `src/ui/later-month.ts` does: on to the start
 * of month `from`, taking each option in `before` on the way, as the e2e build's
 * `?month=N&choose=...` does, and then to the end, taking each option in
 * `choose`, a comma-separated list, once and in order, the first time it is
 * offered. Fails if any option named is never offered.
 */
export function playRun(
  seed: number,
  choose: string | null = null,
  {
    from = 1,
    before = null,
    content = gameContent,
  }: { from?: number; before?: string | null; content?: Content } = {},
): Played {
  const run = startRun({ seed, content });
  let view = playToMonth(run, String(from), before);
  const views = [view];
  const took = new Map<string, number>();
  const wanted = choose ? choose.split(",") : [];
  while (view.choices.length > 0) {
    const named = view.choices.find(
      (c) => "optionId" in c && c.optionId === wanted[0],
    );
    if (named && "optionId" in named) {
      took.set(named.optionId, view.month);
      wanted.shift();
    }
    view = run.choose(named ?? plainChoice(view));
    views.push(view);
  }
  expect(wanted).toEqual([]);
  return { run, views, took };
}

/** The same from month 1, keeping only the views. */
export function playAll(
  seed: number,
  choose: string | null,
  content: Content = gameContent,
): PlayerView[] {
  return playRun(seed, choose, { content }).views;
}

/** Rings the Speak Up line about your boss, in month 8, which gets rid of them on some deals. */
export const REPORT = "ring-about-your-boss";

/** Asks the Senior Analyst for the figures in month 5, and really loads them: every Plan for real. */
export const HONEST =
  "take-the-blame,ask-analyst-for-figures,load-the-real-figures";

/** Getting rid of your boss on Floor 2, by Internal Audit, and on Floor 3, upstairs. */
export const GET_RID = ["audit-your-boss", "nominate-your-boss"];

/** What a player who means to climb does for real on Floors 2 and 3, whenever it is offered. */
export const FOR_REAL = [
  "staff-the-centre",
  "staff-it-now",
  "decide-what-stops",
  "stop-one-programme",
  "tie-it-to-the-roadmap",
  "ask-what-stops",
  "check-the-pack",
  "book-the-desks",
];

/** The same player's word about each open seat, with whoever is above their boss. */
export const FOR_THE_SEAT = [
  "word-with-the-head",
  "word-with-the-programme-manager",
  "word-with-transformation",
];

/** What a player who fakes every Grand Plan does instead. */
export const FOR_SHOW = [
  "sign-on-a-door",
  "report-the-centre-open",
  "lanyards",
  "hang-the-sign",
  "draw-swimlanes",
  "fill-the-template",
  "add-a-swimlane",
  "roadmap-as-a-lesson",
];

/** How a scripted player chooses when nothing it means to take is on offer. */
export type Otherwise = (view: PlayerView, run: Run) => Choice;

/**
 * A scripted player who knows the game but not the deal: takes each of `once`
 * in order, the first time it is offered, then each of `always` whenever it
 * is offered, and otherwise plays plainly, or as `otherwise` says. `watch`
 * sees every view as it comes, as a player reading the run would.
 */
export function climb(
  seed: number,
  once: string,
  always: readonly string[],
  content: Content = gameContent,
  {
    otherwise = plainChoice,
    watch,
  }: {
    otherwise?: Otherwise | undefined;
    watch?: ((view: PlayerView, run: Run) => void) | undefined;
  } = {},
) {
  const run = startRun({ seed, content });
  let view = run.view();
  const views: PlayerView[] = [view];
  const first = once === "" ? [] : once.split(",");
  while (view.choices.length > 0) {
    const offered = (wanted: (id: string) => boolean) =>
      view.choices.find((c) => "optionId" in c && wanted(c.optionId));
    const next = offered((id) => id === first[0]);
    if (next) first.shift();
    const choice: Choice =
      next ?? offered((id) => always.includes(id)) ?? otherwise(view, run);
    view = run.choose(choice);
    views.push(view);
    watch?.(view, run);
  }
  return { run, views, truth: readHiddenTruth(run) };
}
