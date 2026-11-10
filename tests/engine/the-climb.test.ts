import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import type { PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import {
  CLEAN,
  CLIMB,
  FOR_THE_SEAT,
  GET_RID,
  climb,
  playRun,
} from "./real-runs";

// How often each way of playing reaches the top is in tests/balance/the-climb-*.
describe("the climb to the top of Floor 3", () => {
  it("can be won by a scripted run, and the results screen says how", () => {
    const { views } = playRun(2, CLIMB);
    const results = views.at(-1)?.step;
    if (results?.kind !== "results") throw new Error("No results.");
    const won = views.findIndex((v) => v.step.kind === "win");

    expect(views[won]?.month).toBe(15);
    expect(views[won]?.job.id).toBe("middle-manager");
    expect(views[won - 1]?.step).toMatchObject({
      kind: "notice",
      title: "Congratulations: the top of Floor 3",
    });
    expect(views.slice(won + 1).map((v) => v.step.kind)).toEqual(["results"]);
    expect(results.title).toBe("You have reached the top of Floor 3");
    expect(results.ending).toMatchObject({ fired: false, won: true });
    expect(results.ending.text).toContain("month 15");
    expect(results.route.map((r) => r.text)).toEqual([
      "Month 7: Team lead, when Dennis Prowse's Grand Plan was done for show, and Dennis Prowse moved up anyway.",
      "Month 11: Middle manager, when Hugh Lamb's Grand Plan was really done, and Hugh Lamb moved up.",
      "Month 15: the top of Floor 3, when Gwen Ashdown's Grand Plan was really done, and Gwen Ashdown moved up.",
    ]);
  });

  // CLIMB fakes Floor 1's Plan. Seed 67 gets rid of both bosses above Floor 1.
  it("tells a stand-in for winning that goes by how the player got there", () => {
    const standIn = (views: readonly PlayerView[]) => {
      const step = views.find((v) => v.step.kind === "win")?.step;
      return step?.kind === "win" ? step.lines.join(" ") : "";
    };
    const forShow = standIn(playRun(2, CLIMB).views);
    const gotRid = standIn(
      climb(67, CLEAN, [...GET_RID, ...FOR_THE_SEAT], gameContent).views,
    );

    expect(forShow).toContain("a sign on a door");
    expect(gotRid).toContain("got rid of their friends");
  });

  it("rides the lift to Floor 3, to its own bosses, and its own rooms", () => {
    const { views } = playRun(2, CLIMB);
    const floor3 = views.find((v) => v.job.id === "middle-manager");
    const places = new Set(floor3?.hotspots.map((h) => h.place));

    expect(floor3?.month).toBe(12);
    expect(floor3?.job.title).toBe("Middle manager");
    expect(floor3?.orgChart).toContainEqual({
      name: "Gwen Ashdown",
      title: "Programme Manager, your boss",
      reportsTo: "Simone Fairley",
    });
    expect(floor3?.orgChart).toContainEqual({
      name: "Simone Fairley",
      title: "Head of Transformation, your boss's boss",
      reportsTo: null,
    });
    expect(places).toContain("steering-room");
    expect(places).not.toContain("team-room");
    // Nobody of Floor 3 is met before it.
    const below = views.filter((v) => v.job.id !== "middle-manager");
    expect(
      below.some((v) => v.orgChart.some((e) => e.name === "Simone Fairley")),
    ).toBe(false);
  });

  it("ends a run that is not won as before: at the end, or when fired", () => {
    const plain = playRun(8).views.at(-1)?.step;
    const fired = playRun(
      2,
      `${CLEAN},blame-your-analyst,report-the-analyst`,
    ).views.at(-1)?.step;

    expect(plain).toMatchObject({ kind: "results", ending: { won: false } });
    expect(fired).toMatchObject({
      kind: "results",
      ending: { fired: true, won: false },
    });
  });
});

describe("a big mistake at the top of Floor 3", () => {
  // On seed 2 the Senior Analyst has a dangerous Hidden Fact, and Floor 3's
  // seat is open from month 14, after its Plan is done in month 13.
  it("demotes seed 2 to Floor 2, under whoever came next for its seat, and out of the running for the one above", () => {
    const { run, views } = playRun(2, `${CLIMB},blame-the-analyst`);
    const demoted = views.find(
      (v) =>
        v.step.kind === "notice" &&
        v.step.title === "A sideways move, downwards",
    );
    const after = views.find((v) => v.month === 15);
    const results = views.at(-1)?.step;
    if (results?.kind !== "results") throw new Error("No results.");
    const top = readHiddenTruth(run).vacancies.find(
      (v) => v.seat === "programme-manager",
    );

    expect(demoted?.month).toBe(15);
    expect(after?.job).toEqual({ id: "team-lead", title: "Team lead" });
    expect(after?.hotspots.map((h) => h.place)).toContain("team-room");
    expect(views.some((v) => v.step.kind === "win")).toBe(false);
    expect(top?.decided?.winner).toBe("analyst");
    // Nobody tells them who has the seat they were out of the running for.
    // Whoever took their own seat is their boss, under whoever has it.
    expect(
      views.some(
        (v) =>
          v.step.kind === "notice" &&
          v.step.title.startsWith("Congratulations to"),
      ),
    ).toBe(false);
    expect(views.at(-1)?.orgChart).toContainEqual({
      name: "Callum Reed",
      title: "Head of Operations, your boss",
      reportsTo: "Priya Venn",
    });
    expect(results.ending.won).toBe(false);
    expect(results.route.map((r) => r.text)).toEqual([
      expect.stringMatching(/^Month 7: Team lead/),
      expect.stringMatching(/^Month 11: Middle manager/),
      "Month 14: back down to Team lead, after an incident.",
    ]);
  });
});
