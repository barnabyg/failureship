import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type PlayerView } from "../../src/engine";

function sceneIdOf(view: PlayerView) {
  return view.step.kind === "scene" ? view.step.id : null;
}

/** Plays a whole run by a seeded rule, watching for flags and the review. */
function watchRun(seed: number) {
  const run = startRun({ seed, content: gameContent });
  let view = run.view();
  let flags = 0;
  let reviews = 0;
  let walk = seed;
  let reported = view.project.reported;
  while (view.step.kind !== "results") {
    walk = (walk * 31 + 7) % 1009;
    const choice = view.choices[walk % view.choices.length];
    if (!choice) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(choice);
    if (view.project.reported === "Red" && reported !== "Red") flags += 1;
    reported = view.project.reported;
    if (sceneIdOf(view) === "red-project" && choice.type !== "scene") {
      // One choice can explain the Project and, as the month closes, see a
      // Move flag it red again, with no view between in which it is not red.
      if (reviews === flags && reported === "Red") flags += 1;
      reviews += 1;
    }
  }
  // Being fired the month it goes red leaves no time to explain it.
  const { step } = view;
  const fired = step.ending.fired;
  if (fired && reported === "Red" && flags > reviews) flags -= 1;
  return { flags, reviews };
}

describe("the Project Status Review in the game", () => {
  const seeds = Array.from({ length: 80 }, (_, i) => i + 1);

  it("opens if and only if the Project has been flagged red", () => {
    const runs = seeds.map(watchRun);

    expect(runs.some((r) => r.flags > 0)).toBe(true);
    expect(runs.some((r) => r.flags === 0)).toBe(true);
    for (const { flags, reviews } of runs) expect(reviews).toBe(flags);
  });
});
