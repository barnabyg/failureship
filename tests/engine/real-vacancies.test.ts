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
    const { view, truth } = playedTo(2, "8");

    expect(truth.vacancies).toMatchObject([
      { holder: "boss", opened: 6, decides: 7, decided: { winner: "you" } },
    ]);
    expect(view.month).toBe(8);
    expect(view.job).toEqual({ id: "team-lead", title: "Team lead" });
    expect(view.orgChart).toContainEqual({
      name: "You",
      title: "Team lead",
      reportsTo: "Hugh Lamb",
    });
  });

  it("keeps seed 14 a loss to a Rival, who becomes your boss", () => {
    const { view, truth } = playedTo(14, "8");
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
      const { truth } = playedTo(seed, "8");
      return truth.vacancies[0]?.decided;
    });

    expect(outcomes.every((d) => d !== null && d !== undefined)).toBe(true);
    expect(new Set(outcomes.map((d) => d?.winner === "you"))).toEqual(
      new Set([true, false]),
    );
  });
});

describe("those passed over", () => {
  const passedOver = gameContent.moves.filter(
    (m) =>
      m.when !== undefined &&
      JSON.stringify(m.when).includes("lost-the-seat-to-you"),
  );
  const landedIn = (views: PlayerView[]) =>
    views.flatMap((v) =>
      v.step.kind === "move" &&
      passedOver.some((m) => v.step.kind === "move" && m.title === v.step.title)
        ? [v.month]
        : [],
    );

  it("remember it, and come back on a player who had the seat", () => {
    const landed = landedIn(playAll(2, FAKED));

    expect(passedOver).toHaveLength(3);
    expect(landed.length).toBeGreaterThan(0);
    expect(Math.min(...landed)).toBeGreaterThan(7);
  });

  it("do not come back on a player who was passed over with them", () => {
    expect(landedIn(playAll(14, FAKED))).toEqual([]);
  });
});

describe("the decision, as it is told", () => {
  it.each([2, 14])(
    "says who decided and the winner's tie, never anyone's feelings or a Rival, on seed %i",
    (seed) => {
      const views = playAll(seed, FAKED);
      const told = views.find(
        (v) => v.step.kind === "notice" && v.step.decided !== undefined,
      );
      if (told?.step.kind !== "notice") throw new Error("Never told.");
      const inFact = told.step.decided?.inFact ?? "";
      const reasons = gameContent.vacancies?.reasons;
      const secret = [
        reasons?.warm,
        reasons?.neutral,
        reasons?.cold,
        reasons?.owedYou,
      ].map((r) => (r?.why ?? "").split("{decider}").at(-1) ?? "");

      expect(inFact).toMatch(/^The seat was in the gift of /);
      for (const words of secret) expect(inFact).not.toContain(words);
      expect(inFact).not.toMatch(/Rival|As for you/);
      const results = views.at(-1)?.step;
      if (results?.kind !== "results") throw new Error("No results.");
      expect(results.vacancies[0]?.inFact.length).toBeGreaterThan(
        inFact.length,
      );
    },
  );
});

describe("eighteen months on either floor", () => {
  const choiceIn = (view: PlayerView) =>
    (view.step.kind === "notification" || view.step.kind === "scene") &&
    view.step.options.length >= 2;

  it.each([
    ["Floor 1, all the way", 3, null],
    ["Floor 2 from month 8", 2, FAKED],
  ])("leaves a real choice every month: %s", (_name, seed, choose) => {
    const views = playAll(seed, choose);

    const months = new Set(views.filter(choiceIn).map((v) => v.month));
    expect([...months].sort((a, b) => a - b)).toEqual(
      Array.from({ length: gameContent.balance.monthsPerRun }, (_, i) => i + 1),
    );
    expect(views.at(-1)?.job.id).toBe(choose ? "team-lead" : "junior-employee");
  });
});
