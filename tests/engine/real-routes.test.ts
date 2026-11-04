import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice } from "../../src/ui/later-month";

/** Fakes the Plan at month 5's Ideas Workshop, which a boss who is not a Believer counts. */
const PLAN = "screenshot-on-the-note";
/** Rings the Speak Up line about your boss, in month 8. */
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

// The browser tests and docs/playtest.md rely on seed 87.
describe("two ways up, on the same deal", () => {
  it("earns seed 87 a promotion by the Grand Plan", () => {
    const { views, truth } = playAll(87, PLAN);

    expect(truth.vacancies[0]).toMatchObject({
      holder: "boss",
      way: "plan",
      opened: 6,
      decided: { winner: "you" },
    });
    expect(firstOnFloor2(views)).toBe(8);
  });

  it("earns seed 87 a promotion by getting rid of your boss instead", () => {
    const { views, truth } = playAll(87, REPORT);
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
    // Whoever is the player's boss on Floor 2, it is never the boss who went.
    expect(
      views
        .filter((v) => v.month > 8)
        .flatMap((v) => v.orgChart)
        .some((e) => e.name === "Dennis Prowse"),
    ).toBe(false);
  });

  it("leaves a hidden risk that the report can be traced to the player", () => {
    const { truth } = playAll(87, REPORT);

    expect(truth.risks.map((r) => r.id)).toContain("boss-undone");
  });
});

describe("other seats in the game", () => {
  it("open by a secondment, a new post, or a boss's going, on some deals", () => {
    const ways = new Set<string>();
    for (const seed of [1, 3, 9]) {
      const { truth } = playAll(seed, seed === 9 ? REPORT : PLAN);
      for (const v of truth.vacancies) ways.add(v.way);
    }

    expect([...ways].sort()).toEqual(["created", "fired", "movedUp"]);
  });
});
