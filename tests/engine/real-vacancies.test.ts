import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice, playToMonth } from "../../src/ui/later-month";

/** Fakes the Plan at month 5's Ideas Workshop, which a boss who is not a Believer counts. */
const FAKED = "screenshot-on-the-note";

function playedTo(seed: number, month: string, choose: string | null = FAKED) {
  const run = startRun({ seed, content: gameContent });
  const view = playToMonth(run, month, choose);
  return { run, view, truth: readHiddenTruth(run) };
}

/** Plays a whole run plainly, taking that option once, and keeps every view. */
function playAll(seed: number, choose: string | null): PlayerView[] {
  const run = startRun({ seed, content: gameContent });
  let view = run.view();
  const views = [view];
  let wanted = choose;
  while (view.choices.length > 0) {
    const named = view.choices.find(
      (c) => "optionId" in c && c.optionId === wanted,
    );
    if (named) wanted = null;
    view = run.choose(named ?? plainChoice(view));
    views.push(view);
  }
  return views;
}

describe("the first promotion in the game", () => {
  // The browser tests rely on these two deals.
  it("keeps seed 2 a win: the seat is yours, and the lift takes you up", () => {
    const { view, truth } = playedTo(2, "7");

    expect(truth.vacancies).toMatchObject([
      { holder: "boss", opened: 6, decides: 6, decided: { winner: "you" } },
    ]);
    expect(view.month).toBe(7);
    expect(view.job).toEqual({ id: "team-lead", title: "Team lead" });
    expect(view.orgChart).toContainEqual({
      name: "You",
      title: "Team lead",
      reportsTo: "Hugh Lamb",
    });
  });

  it("keeps seed 14 a loss to a Rival, who becomes your boss", () => {
    const { view, truth } = playedTo(14, "7");
    const decided = truth.vacancies[0]?.decided;

    expect(decided?.winner).toBe("associate");
    expect(truth.rivals.map((r) => r.character)).toContain("associate");
    expect(view.job.id).toBe("junior-employee");
    expect(view.orgChart).toContainEqual({
      name: "Tessa Croft",
      title: "Team Leader, your boss",
      reportsTo: "Hugh Lamb",
    });
  });

  it("is won on some deals and lost on others, on the same choices", () => {
    // The same choices, on deals whose bosses all count the Plan done.
    const outcomes = [2, 14, 4, 5, 7, 9, 10, 11, 12].map((seed) => {
      const { truth } = playedTo(seed, "7");
      return truth.vacancies[0]?.decided;
    });

    expect(outcomes.every((d) => d !== null && d !== undefined)).toBe(true);
    expect(new Set(outcomes.map((d) => d?.winner === "you"))).toEqual(
      new Set([true, false]),
    );
  });
});

describe("those passed over", () => {
  it("remember it, and come back on the player later", () => {
    const views = playAll(2, FAKED);
    const passedOver = gameContent.moves.filter(
      (m) =>
        m.when !== undefined &&
        JSON.stringify(m.when).includes("passed-over-for-the-seat"),
    );
    const landed = views.flatMap((v) =>
      v.step.kind === "move" &&
      passedOver.some((m) => v.step.kind === "move" && m.title === v.step.title)
        ? [v.month]
        : [],
    );

    expect(passedOver).toHaveLength(3);
    expect(landed.length).toBeGreaterThan(0);
    expect(Math.min(...landed)).toBeGreaterThan(6);
  });
});

describe("eighteen months on either floor", () => {
  const choiceIn = (view: PlayerView) =>
    (view.step.kind === "notification" || view.step.kind === "scene") &&
    view.step.options.length >= 2;

  it.each([
    ["Floor 1, all the way", 3, null],
    ["Floor 2 from month 7", 2, FAKED],
  ])("leaves a real choice every month: %s", (_name, seed, choose) => {
    const views = playAll(seed, choose);

    const months = new Set(views.filter(choiceIn).map((v) => v.month));
    expect([...months].sort((a, b) => a - b)).toEqual(
      Array.from({ length: gameContent.balance.monthsPerRun }, (_, i) => i + 1),
    );
    expect(views.at(-1)?.job.id).toBe(choose ? "team-lead" : "junior-employee");
  });
});
