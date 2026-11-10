import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { DECISIONS, reach } from "./budget-runs";

describe("one-off Budgets", () => {
  it("offers at least two different decisions in a run", () => {
    for (const [id] of DECISIONS) {
      const run = startRun({ seed: 1, content: gameContent });
      const { step } = reach(run, id);
      if (step.kind !== "notification") throw new Error(step.kind);

      expect(step.options.length).toBeGreaterThan(2);
    }
    expect(
      gameContent.scenes.find((s) => s.id === "budget-round")?.options.length,
    ).toBeGreaterThan(2);
  });

  // How each decision lands with each kind of boss is in
  // tests/balance/budgets.test.ts.

  it("has an immediate effect on the people involved", () => {
    for (const [id, options] of DECISIONS) {
      for (const optionId of options) {
        const written = gameContent.notifications
          .find((n) => n.id === id)
          ?.options.find((o) => o.id === optionId);

        expect(written?.result?.body, optionId).toBeTruthy();
        expect(written?.sets.length, optionId).toBeGreaterThan(0);
      }
    }
    // Paying the people who do the work does the work some good.
    const run = startRun({ seed: 1, content: gameContent });
    reach(run, "bonus-pot");
    const before = run.view().project.real;
    const after = run.choose({
      type: "notification",
      notificationId: "bonus-pot",
      optionId: "bonus-workers",
    }).project.real;
    const statuses = gameContent.project.statuses.map((s) => s.label);

    expect(before).not.toBe("Green");
    expect(statuses.indexOf(after)).toBe(statuses.indexOf(before) - 1);
  });

  it("keeps no balance or running total, on screen or in the rules", () => {
    const run = startRun({ seed: 1, content: gameContent });
    reach(run, "bonus-pot");
    const view = run.view();
    const money = /budget|balance|money|funds|remaining.*£|£/i;

    expect(Object.keys(view).filter((key) => money.test(key))).toEqual([]);
    expect(
      Object.keys(gameContent.balance).filter((key) =>
        /budget|money/i.test(key),
      ),
    ).toEqual([]);
    expect(JSON.stringify(view.step)).not.toMatch(/£\d|\$\d/);
    const truth = readHiddenTruth(run);
    expect(
      Object.keys(truth).filter((key) => /budget|money|funds/i.test(key)),
    ).toEqual([]);
  });
});
