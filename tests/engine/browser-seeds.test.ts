import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type PlayerView } from "../../src/engine";
import { plainChoice, playToMonth } from "../../src/ui/later-month";

/**
 * Plays the real game as the browser tests' helpers do, from the start of a
 * month, taking an option once where offered, and keeps every view to the end.
 */
function playFrom(seed: number, month: number, take?: string): PlayerView[] {
  const run = startRun({ seed, content: gameContent });
  let view = playToMonth(run, String(month));
  const views = [view];
  let wanted = take;
  while (view.choices.length > 0) {
    const named = view.choices.find(
      (c) => "optionId" in c && c.optionId === wanted,
    );
    if (named) wanted = undefined;
    view = run.choose(named ?? plainChoice(view));
    views.push(view);
  }
  expect(wanted).toBeUndefined();
  return views;
}

const yourBoss = (view: PlayerView | undefined) =>
  view?.orgChart.find((e) => e.title.endsWith(", your boss"))?.name;

// Each browser test that walks a seed on needs its deal to stay as it plays it.
// A failure here names the browser test whose seed has moved.
describe("the seeds the browser tests walk", () => {
  it("keeps seed 8 on Floor 1 for all eighteen months, for full-run.spec.ts", () => {
    const views = playFrom(8, 1);

    expect(views.at(-1)?.step.kind).toBe("results");
    expect(views.filter((v) => v.job.id !== "junior-employee")).toEqual([]);
  });

  it("keeps seed 283's Incompetent boss as your boss to the end, for boss.spec.ts", () => {
    const views = playFrom(283, 9, "praise-dennis");
    const results = views.at(-1)?.step;
    if (results?.kind !== "results") throw new Error("No results.");

    expect(views.filter((v) => v.job.id !== "junior-employee")).toEqual([]);
    expect(views.every((v) => yourBoss(v) === "Dennis Prowse")).toBe(true);
    expect(results.boss.kind).toBe("Incompetent");
  });

  it("keeps seed 1 on Floor 1 under its first boss as month 8 opens, for notebook.spec.ts", () => {
    const views = playFrom(1, 8);

    expect(views[0]?.month).toBe(8);
    expect(views[0]?.job.id).toBe("junior-employee");
    expect(yourBoss(views[0])).toBe("Dennis Prowse");
    expect(views.at(-1)?.step.kind).toBe("results");
  });
});
