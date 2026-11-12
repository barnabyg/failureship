import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type Choice, type PlayerView } from "../../src/engine";
import { notesIn } from "../engine/landed";

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

describe("Demands in the game", () => {
  it("are sometimes forgotten and sometimes chased in the real game", () => {
    const outcomes = new Set<string>();
    for (const seed of SEEDS) {
      const run = startRun({ seed, content: gameContent });
      let view = run.view();
      while (view.step.kind !== "results") {
        const { step } = view;
        // Forgotten, it is told as the month opens, in a note in the inbox.
        const told = [
          ...(step.kind === "notice" ? [step] : []),
          ...notesIn(view),
        ];
        if (view.openDemands.length === 0) {
          for (const { body } of told) {
            if (/forget|never spoken|not mentioned again/i.test(body)) {
              outcomes.add("forgotten");
            }
          }
        }
        if (step.kind === "notification" && step.id.endsWith("-chased")) {
          outcomes.add("chased");
        }
        view = run.choose(pickToward(view));
      }
    }

    expect(outcomes).toEqual(new Set(["forgotten", "chased"]));
  });
});

/** Stalls every Demand, and otherwise answers for nothing. */
function pickToward(view: PlayerView): Choice {
  const { step } = view;
  if (step.kind === "notification") {
    const free = step.options.find((o) => o.costLabel === "Costs nothing");
    const stall = step.options.find((o) => o.id === "stall");
    const chosen = stall ?? free ?? step.options[0];
    if (chosen) {
      return {
        type: "notification",
        notificationId: step.id,
        optionId: chosen.id,
      };
    }
  }
  const next = view.choices[0];
  if (!next) throw new Error(`Stuck at ${step.kind}.`);
  return next;
}
