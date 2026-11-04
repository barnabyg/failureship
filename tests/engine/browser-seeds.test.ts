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

  it("keeps seed 2 a Team lead in month 11 who wins the way out of Floor 3 in month 15, for win.spec.ts", () => {
    const { views } = playRun(2, "decide-what-stops", {
      from: 11,
      before: `${CLEAN},staff-the-centre`,
    });
    const floor3 = views.find((v) => v.job.id === "middle-manager");
    const results = views.at(-1)?.step;

    expect(views[0]?.job.id).toBe("team-lead");
    expect(floor3?.month).toBe(12);
    expect(views.find((v) => v.step.kind === "win")?.month).toBe(15);
    expect(results).toMatchObject({ kind: "results", ending: { won: true } });
  });
  it("keeps seed 24 a Middle manager in month 14, whose boss asks at the Board, and who hears of a question taken offline in month 15, for floor-3-moves.spec.ts", () => {
    const { views } = playRun(24, "take-it-offline", {
      from: 14,
      before: `${CLEAN},staff-the-centre`,
    });
    const board = views.find(
      (v) => v.step.kind === "scene" && v.step.id === "the-board",
    );
    const chased = views.find(
      (v) =>
        v.step.kind === "notification" && v.step.id === "board-offline-chased",
    );

    expect(views[0]?.month).toBe(14);
    expect(views[0]?.job.id).toBe("middle-manager");
    expect(board?.step.kind === "scene" && board.step.narration[0]).toContain(
      "when your boss asks, warmly",
    );
    expect(chased?.month).toBe(15);
    expect(chased?.job.id).toBe("middle-manager");
  });
});
