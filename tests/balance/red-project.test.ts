import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type Choice, type PlayerView } from "../../src/engine";
import { plainChoice } from "../../src/ui/later-month";

function sceneIdOf(view: PlayerView) {
  return view.step.kind === "scene" ? view.step.id : null;
}

/** A seeded walk over whatever is offered, which lets the Project go red. */
function walking(seed: number) {
  let walk = seed;
  return (view: PlayerView): Choice | undefined => {
    walk = (walk * 31 + 7) % 1009;
    return view.choices[walk % view.choices.length];
  };
}

/** Plays a whole run by a rule, watching for flags and the review. */
function watchRun(
  seed: number,
  pick: (view: PlayerView) => Choice | undefined,
) {
  const run = startRun({ seed, content: gameContent });
  let view = run.view();
  let flags = 0;
  let reviews = 0;
  let reported = view.project.reported;
  while (view.step.kind !== "results") {
    const choice = pick(view);
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
    // A walk at random seldom files every report, so the plain player, who
    // does, is there to see a run that is never flagged.
    const runs = [
      ...seeds.map((seed) => watchRun(seed, walking(seed))),
      ...seeds.slice(0, 5).map((seed) => watchRun(seed, plainChoice)),
    ];

    expect(runs.some((r) => r.flags > 0)).toBe(true);
    expect(runs.some((r) => r.flags === 0)).toBe(true);
    for (const { flags, reviews } of runs) expect(reviews).toBe(flags);
  });
});
