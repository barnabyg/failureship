import { expect } from "vitest";
import { gameContent } from "../../src/content";
import {
  startRun,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { plainChoice, playToMonth } from "../../src/ui/later-month";

/** Fakes the Plan at month 5's Ideas Workshop, which a boss who is not a Believer counts. */
export const FAKED = "screenshot-on-the-note";

/**
 * Takes the blame in month 2's Lessons Learned Review, which keeps the record
 * clean, and fakes the Plan: on seeds 2 and 16 the seat is yours, and Floor 2
 * starts in month 8.
 */
export const CLEAN = `take-the-blame,${FAKED}`;

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
