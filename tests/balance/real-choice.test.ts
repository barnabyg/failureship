import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type Choice, type PlayerView } from "../../src/engine";
import { SEEDS, costOf, notifications } from "./styles";

/** What a dutiful player has left on the floor, month by month. */
function floorActions(seed: number, dutiful: boolean) {
  const run = startRun({ seed, content: gameContent });
  const left: { month: number; remaining: number; open: number }[] = [];
  let view: PlayerView = run.view();
  let seenMonth = 0;
  while (view.choices.length > 0) {
    const { step } = view;
    if (step.kind === "actions" && view.month !== seenMonth) {
      seenMonth = view.month;
      left.push({
        month: view.month,
        remaining: view.actions.remaining,
        open: view.choices.length,
      });
    }
    const options = step.kind === "notification" ? step.options : [];
    const costed = options.find(
      (o) => o.affordable && o.costLabel !== "Costs nothing",
    );
    const free = options.find((o) => o.costLabel === "Costs nothing");
    const answer = dutiful ? (costed ?? free) : free;
    // A dutiful player explains a red Project once, by telling the truth.
    const truthful = view.choices.find(
      (c) => c.type === "scene" && c.optionId === "tell-the-truth",
    );
    const next: Choice | undefined =
      step.kind === "notification" && answer
        ? { type: "notification", notificationId: step.id, optionId: answer.id }
        : (truthful ?? view.choices[0]);
    if (!next) throw new Error(`Stuck at ${step.kind}.`);
    view = run.choose(next);
  }
  return left;
}

describe("every month leaves a real choice", { timeout: 60_000 }, () => {
  it("offers something free on every Notification, so nothing is forced", () => {
    for (const n of notifications) {
      expect(
        n.options.some((o) => costOf(o.cost) === 0),
        n.id,
      ).toBe(true);
    }
  });

  it("lets a player who answers for nothing choose on the floor, every month", () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const months = floorActions(seed, false);

      expect(months.map((m) => m.month)).toEqual(
        Array.from(
          { length: gameContent.balance.monthsPerRun },
          (_, i) => i + 1,
        ),
      );
      for (const { remaining, open } of months) {
        expect(remaining).toBeGreaterThanOrEqual(2);
        expect(open).toBeGreaterThanOrEqual(2);
      }
    }
  });

  // Reached by the balance data: at first it was fewer than one month in five.
  it("leaves even a dutiful player an action of their own in most months", () => {
    let months = 0;
    let free = 0;
    for (const seed of SEEDS.slice(0, 100)) {
      for (const { remaining, open } of floorActions(seed, true)) {
        months += 1;
        expect(open).toBeGreaterThanOrEqual(remaining > 0 ? 2 : 0);
        if (remaining > 0) free += 1;
      }
      // A month with nothing left never reaches the floor at all, so it counts too.
      months +=
        gameContent.balance.monthsPerRun - floorActions(seed, true).length;
    }

    expect(free / months).toBeGreaterThan(0.6);
  });

  it("asks for at most one costly answer a month, beside the report", () => {
    const every = [
      ...gameContent.notifications,
      ...(gameContent.demands?.items ?? []),
    ];
    for (const { job } of gameContent.floors) {
      for (let m = 1; m <= gameContent.balance.monthsPerRun; m++) {
        const costly = every.filter(
          (n) =>
            (n.floor === undefined || n.floor === job) &&
            n.months?.includes(m) &&
            n.options.some((o) => costOf(o.cost) > 0),
        );

        expect(costly.length, `${job} month ${String(m)}`).toBeLessThanOrEqual(
          1,
        );
      }
    }
  });
});
