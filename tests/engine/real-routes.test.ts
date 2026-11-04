import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice } from "../../src/ui/later-month";

/** Fakes the Plan at month 5's Ideas Workshop, which a boss who is not a Believer counts. */
const PLAN = "screenshot-on-the-note";
/** Rings the Speak Up line about your boss, in month 8. Only the Office Co-ordinator knows who called. */
const REPORT = "ring-about-your-boss";

/**
 * Plays a whole run plainly, taking each option named, a comma-separated list,
 * once and in order, and keeps every view.
 */
function playAll(seed: number, choose: string) {
  const run = startRun({ seed, content: gameContent });
  let view = run.view();
  const views = [view];
  const wanted = choose.split(",");
  while (view.choices.length > 0) {
    const named = view.choices.find(
      (c) => "optionId" in c && c.optionId === wanted[0],
    );
    if (named) wanted.shift();
    view = run.choose(named ?? plainChoice(view));
    views.push(view);
  }
  expect(wanted).toEqual([]);
  return { views, truth: readHiddenTruth(run) };
}

const firstOnFloor2 = (views: PlayerView[]) =>
  views.find((v) => v.job.id === "team-lead")?.month;

const noticed = (views: PlayerView[], title: string) =>
  views.find((v) => v.step.kind === "notice" && v.step.title === title);

// The browser tests and docs/playtest.md rely on seed 43.
describe("two ways up, on the same deal", () => {
  it("earns seed 43 a promotion by the Grand Plan", () => {
    const { views, truth } = playAll(43, PLAN);

    expect(truth.vacancies[0]).toMatchObject({
      holder: "boss",
      way: "plan",
      opened: 6,
      decided: { winner: "you" },
    });
    expect(firstOnFloor2(views)).toBe(8);
  });

  it("earns seed 43 a promotion by getting rid of your boss instead, which is traced to you later", () => {
    const { views, truth } = playAll(43, REPORT);
    const decided = truth.vacancies[0]?.decided;

    expect(truth.vacancies[0]).toMatchObject({
      holder: "boss",
      way: "fired",
      opened: 9,
      decides: 10,
    });
    expect(decided?.winner).toBe("you");
    // Decided by whoever held influence over the boss, who fired them.
    expect(decided?.decider).toBe(truth.vacancies[0]?.patron);
    expect(noticed(views, "A change in the team")?.month).toBe(8);
    expect(firstOnFloor2(views)).toBe(11);
    // Whoever is the player's boss from then on, it is never the boss who went.
    expect(
      views
        .filter((v) => v.month > 8)
        .flatMap((v) => v.orgChart)
        .some((e) => e.name === "Dennis Prowse"),
    ).toBe(false);
    // The call comes out through the Office Co-ordinator's log, as a big
    // mistake on Floor 2, which takes the player back down.
    expect(truth.risks.find((r) => r.id === "line-call")?.cameOut).toEqual({
      month: 12,
      onPlayer: true,
    });
    expect(
      views.find((v) => v.step.kind === "move" && v.month === 12)?.step,
    ).toMatchObject({ title: "A note for the file" });
    expect(noticed(views, "A sideways move, downwards")?.month).toBe(13);
    expect(views.at(-1)?.job.id).toBe("junior-employee");
  });

  it("costs seed 31 the seat it opened, when the call comes out while it is open", () => {
    const { truth } = playAll(31, REPORT);

    expect(truth.risks.find((r) => r.id === "line-call")?.cameOut).toEqual({
      month: 10,
      onPlayer: true,
    });
    expect(truth.vacancies[0]).toMatchObject({
      way: "fired",
      decided: { blocked: true },
    });
  });
});

describe("other seats in the game", () => {
  // docs/playtest.md relies on these deals.
  it("open by a secondment, a new post, or a boss leaving, on some deals", () => {
    const opened = (seed: number, choose: string) =>
      playAll(seed, choose).truth.vacancies.map((v) => ({
        way: v.way,
        opened: v.opened,
        winner: v.decided?.winner,
      }));

    // Seed 11's Plan seat goes to the Junior Associate, who is seconded upstairs.
    expect(opened(11, PLAN)).toEqual([
      { way: "plan", opened: 6, winner: "associate" },
      { way: "movedUp", opened: 12, winner: "you" },
    ]);
    expect(opened(3, PLAN)).toEqual([
      { way: "created", opened: 14, winner: "associate" },
    ]);
    // Seed 8's boss, a Believer, survives the line, and leaves over it.
    expect(opened(8, REPORT)).toEqual([
      { way: "left", opened: 10, winner: "you" },
    ]);
  });
});
