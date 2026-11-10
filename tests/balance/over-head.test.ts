import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type Choice } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const GO: Choice = { type: "action", actionId: "over-head" };

describe("going over your boss's head", () => {
  it("is not simply the best action every month", () => {
    const finalBelief = (seed: number, climbs: boolean) => {
      const run = startRun({ seed, content: gameContent });
      let view = run.view();
      while (view.step.kind !== "results") {
        const { step } = view;
        const free =
          step.kind === "notification"
            ? step.options.find((o) => o.costLabel === "Costs nothing")
            : undefined;
        const climb =
          climbs &&
          view.choices.some((c) => JSON.stringify(c) === JSON.stringify(GO));
        const ordinary = view.choices.find(
          (c) => c.type !== "action" || c.actionId === "kitchen",
        );
        const next: Choice | undefined =
          step.kind === "notification" && free
            ? {
                type: "notification",
                notificationId: step.id,
                optionId: free.id,
              }
            : climb
              ? GO
              : (ordinary ?? view.choices[0]);
        if (!next) throw new Error(`Stuck at ${step.kind}.`);
        view = run.choose(next);
      }
      return readHiddenTruth(run).bossBelief;
    };
    // Twenty-five is plenty: climbing every month leaves the boss's belief
    // over 11 lower on all 16 sets of twenty-five tried.
    const mean = (climbs: boolean) =>
      SEEDS.slice(0, 25).reduce((sum, s) => sum + finalBelief(s, climbs), 0) /
      25;

    expect(mean(true)).toBeLessThan(mean(false));
  });

  it("never shows either belief or kind before the run ends", () => {
    for (const seed of SEEDS) {
      const run = startRun({ seed, content: gameContent });
      let view = run.view();
      let turn = 0;
      while (view.step.kind !== "results") {
        const seen = JSON.stringify(view);
        expect(seen).not.toMatch(/opinion/i);
        expect(seen).not.toMatch(/Believer|Incompetent|Practitioner/);
        const climb = view.choices.find(
          (c) => c.type === "action" && c.actionId === "over-head",
        );
        const next = climb ?? view.choices[turn++ % view.choices.length];
        if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
        view = run.choose(next);
      }
    }
  });
});
