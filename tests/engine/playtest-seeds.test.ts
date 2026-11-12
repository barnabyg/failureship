import { describe, expect, it } from "vitest";
import type { PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { firstTold } from "./landed";
import { CLEAN, CLIMB, FAKED, REPORT, playRun } from "./real-runs";

/** The month a notice with this title was told, if it was. */
const told = (views: readonly PlayerView[], title: string) =>
  firstTold(views, title)?.month;

/** The first month the player was in this job. */
const firstIn = (views: readonly PlayerView[], job: string) =>
  views.find((v) => v.job.id === job)?.month;

const endOf = (views: readonly PlayerView[]) => {
  const step = views.at(-1)?.step;
  if (step?.kind !== "results") throw new Error("No results.");
  return step;
};

// docs/playtest.md's "Seven seeds to start with", each played as its row says.
describe("the seven seeds the playtest starts with", () => {
  it("seed 2 goes up by the Grand Plan", () => {
    const { run, views } = playRun(2, CLEAN);

    expect(readHiddenTruth(run).vacancies[0]).toMatchObject({
      way: "plan",
      opened: 6,
      decided: { month: 7, winner: "you" },
    });
    expect(told(views, "Congratulations: Team lead")).toBe(8);
    expect(firstIn(views, "team-lead")).toBe(8);
  });

  it("seed 43 gets rid of its boss, and is taken back down when blaming the call on the wrong person", () => {
    const { run, views } = playRun(43, `${REPORT},line-blame-the-analyst`);

    expect(readHiddenTruth(run).vacancies[0]).toMatchObject({
      way: "fired",
      ousted: true,
      decided: { month: 10, winner: "you" },
    });
    expect(
      views.find(
        (v) =>
          v.step.kind === "escape" && v.step.title === "A note for the file",
      )?.month,
    ).toBe(12);
    expect(told(views, "A sideways move, downwards")).toBe(13);
  });

  it("seed 11 goes up when a Company Event seconds the Junior Associate upstairs", () => {
    const { run, views } = playRun(11, FAKED);
    const [first, second] = readHiddenTruth(run).vacancies;

    expect(first?.decided?.winner).toBe("associate");
    expect(second).toMatchObject({
      way: "movedUp",
      holder: "associate",
      decided: { month: 13, winner: "you" },
    });
    expect(firstIn(views, "team-lead")).toBe(14);
  });

  it("seed 12 loses its seat to a Rival, who took the Plan's credit", () => {
    const { run } = playRun(12, FAKED);
    const truth = readHiddenTruth(run);

    expect(truth.vacancies[0]).toMatchObject({
      credit: "associate",
      decided: { month: 7, winner: "associate" },
    });
    expect(truth.rivals.map((r) => r.character)).toContain("associate");
  });

  it("seed 2 is demoted by a big mistake in the seat it won", () => {
    const { views } = playRun(2, `${CLEAN},blame-your-analyst`);

    expect(told(views, "A letter in a plain envelope")).toBe(9);
    expect(told(views, "A sideways move, downwards")).toBe(10);
    expect(views.find((v) => v.month === 11)?.job.id).toBe("junior-employee");
  });

  it("seed 9 is fired by a second big mistake", () => {
    const { views, took } = playRun(9, "blame-callum,cut-callum");
    const end = endOf(views);

    expect([took.get("blame-callum"), took.get("cut-callum")]).toEqual([2, 4]);
    expect(told(views, "A letter in a plain envelope")).toBe(2);
    expect(end.ending).toMatchObject({ fired: true, won: false });
    expect(end.ending.text).toContain("month 4");
  });

  it("seed 2 wins, as month 15 closes", () => {
    const { views } = playRun(2, CLIMB);

    expect(told(views, "Congratulations: the top of Floor 3")).toBe(15);
    expect(endOf(views).ending.won).toBe(true);
    expect(endOf(views).route.map((r) => r.month)).toEqual([7, 11, 15]);
  });
});
