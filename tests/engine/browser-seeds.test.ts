import { describe, expect, it } from "vitest";
import type { PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { CLEAN, playRun } from "./real-runs";

/** Plays the real game from the start of a month, taking an option once where offered. */
const playFrom = (seed: number, month: number, take?: string) =>
  playRun(seed, take ?? null, { from: month }).views;

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

  it("keeps seed 16 a Team lead under a Believer from month 8, who hears of the old friend in month 12, for floor-2-moves.spec.ts", () => {
    const { run, views } = playRun(16, "hire-your-friend", {
      from: 11,
      before: CLEAN,
    });
    const furious = views.find(
      (v) =>
        v.step.kind === "notification" && v.step.id === "friend-boss-furious",
    );
    const boss = readHiddenTruth(run).characters.find((c) => c.id === "head");

    expect(views[0]?.month).toBe(11);
    expect(views.slice(0, -1).every((v) => v.job.id === "team-lead")).toBe(
      true,
    );
    expect(boss?.kind).toBe("believer");
    expect(yourBoss(views[0])).toBe("Hugh Lamb");
    expect(furious?.month).toBe(12);
  });
});
