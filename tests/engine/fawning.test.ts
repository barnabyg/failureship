import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { dependsOnHiddenTruth } from "../../src/engine/truth-checks";
import { plainChoice } from "../../src/ui/later-month";

const fawning = (view: PlayerView) =>
  view.gauges.find((g) => g.id === "fawning");

/** The real Threads that move Fawning. */
const fawningThreads = gameContent.threads.filter((t) =>
  t.outcomes.some((o) => o.gauges.some((g) => g.gauge === "fawning")),
);

/** Plays a whole real run, choosing these where they are offered, and plainly otherwise. */
function playOut(run: Run, wanted: readonly string[] = []): PlayerView[] {
  const views = [run.view()];
  for (let view = run.view(); view.choices.length > 0;) {
    const choice: Choice =
      view.choices.find(
        (c) =>
          (c.type === "scene" || c.type === "notification") &&
          wanted.includes(c.optionId),
      ) ?? plainChoice(view);
    view = run.choose(choice);
    views.push(view);
  }
  return views;
}

/** Sucks up to both managers all year, and takes the blame rather than be fired. */
const CRAWLING = [
  "back-boss",
  "take-the-blame",
  "sit-by-head",
  "credit-head",
  "animate",
  "bonus-boss",
  "underspend-chairs",
];

describe("Fawning", () => {
  it("starts at 30, is in view at every step, and an ordinary run moves it", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const views = playOut(startRun({ seed, content: gameContent }));
      for (const view of views) {
        expect(fawning(view)?.value, String(seed)).toBeTypeOf("number");
      }
      expect(views[0] && fawning(views[0])?.value).toBe(30);
      const end = views.at(-1);
      expect(end && fawning(end)?.moves.length, String(seed)).toBeGreaterThan(
        0,
      );
      const stories = views.flatMap((v) =>
        v.step.kind === "story" ? v.step.gauges : [],
      );
      expect(stories.some((line) => line.startsWith("Fawning"))).toBe(true);
    }
  });

  it("ends the same on deals with different Power Maps when the same Threads play out", () => {
    const startedFawning = new Set(fawningThreads.map((t) => t.started));
    const byThreads = new Map<
      string,
      { maps: Set<string>; values: Set<number | undefined> }
    >();
    for (let seed = 1; seed <= 40; seed++) {
      const run = startRun({ seed, content: gameContent });
      const map = JSON.stringify(readHiddenTruth(run).powerMap);
      const end = playOut(run, CRAWLING).at(-1);
      if (end?.step.kind !== "results") throw new Error("No results.");
      expect(end.step.ending.fired).toBe(false);
      // Which Threads played out, whatever came of each.
      const key = JSON.stringify(
        end.step.threads
          .map((t) => t.started)
          .filter((text) => startedFawning.has(text))
          .sort(),
      );
      const group = byThreads.get(key) ?? {
        maps: new Set(),
        values: new Set(),
      };
      group.maps.add(map);
      group.values.add(fawning(end)?.value);
      byThreads.set(key, group);
    }

    for (const { values } of byThreads.values()) expect(values.size).toBe(1);
    // All six played out: up for agreeing with your boss, the credit, the bonus pot
    // and the chairs, and down for the frozen slides and for siding with both.
    const all = [...byThreads.entries()].find(
      ([key]) => (JSON.parse(key) as string[]).length === 6,
    )?.[1];
    expect(all?.maps.size).toBeGreaterThan(5);
    expect([...(all?.values ?? [])]).toEqual([55]);
  });

  it("starts only from choices aimed at a manager, and never reads the hidden truth", () => {
    const aimedAtAManager = new Set([
      "back-head",
      "back-boss",
      "sit-by-head",
      "sit-by-boss",
      "credit-head",
      "credit-boss",
      "animate",
      "bonus-boss",
      "underspend-chairs",
    ]);
    const options = [
      ...gameContent.scenes.flatMap((s) =>
        s.options.map((o) => ({
          id: o.id,
          sets: o.results.map((r) => r.sets),
        })),
      ),
      ...gameContent.notifications.flatMap((n) =>
        n.options.map((o) => ({ id: o.id, sets: [o.sets] })),
      ),
    ];
    const people = gameContent.characters.flatMap((c) => [
      c.name.toLowerCase(),
      (c.called ?? c.name).toLowerCase(),
    ]);

    expect(fawningThreads).toHaveLength(6);
    for (const thread of fawningThreads) {
      const starters = options.filter((o) =>
        o.sets.some((s) => s.includes(thread.startedBy)),
      );
      expect(starters.length, thread.id).toBeGreaterThan(0);
      for (const starter of starters) {
        expect(aimedAtAManager.has(starter.id), starter.id).toBe(true);
        // Every result starts it, so whether it starts never reads the truth.
        for (const sets of starter.sets) {
          expect(sets, starter.id).toContain(thread.startedBy);
        }
      }
      for (const outcome of thread.outcomes) {
        if (outcome.when) {
          expect(dependsOnHiddenTruth(outcome.when), thread.id).toBe(false);
        }
        // A Bill through someone who has left would not arrive, and leaving is dealt.
        const from = (outcome.bill.from ?? "").toLowerCase();
        for (const person of people)
          expect(from, thread.id).not.toContain(person);
        expect(
          outcome.gauges.map((g) => g.gauge),
          thread.id,
        ).toEqual(["fawning"]);
      }
    }
  });
});
