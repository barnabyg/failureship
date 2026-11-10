import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { SEEDS, playIn, rank, type Style } from "./styles";

describe("the boss's belief stays worth reading", { timeout: 60_000 }, () => {
  it("ends a run within reach of the thresholds, not many times past them", () => {
    const { warmAt } = gameContent.balance.mood;
    const finals = SEEDS.slice(0, 60).flatMap((seed) =>
      (["straight", "showy", "useful"] as const).map(
        (style) => playIn(seed, style).bossBelief,
      ),
    );

    expect(Math.max(...finals.map(Math.abs))).toBeLessThan(warmAt * 5);
  });

  it("is not settled in the first months, whatever the player does", () => {
    const { warmAt, coldAt } = gameContent.balance.mood;
    const styles: Style[] = ["straight", "showy", "useful"];
    let runs = 0;
    let open = 0;
    for (const seed of SEEDS.slice(0, 60)) {
      for (const style of styles) {
        const run = startRun({ seed, content: gameContent });
        let view = run.view();
        while (view.month === 1) {
          const best = [...view.choices].sort(
            (a, b) => rank(a, style) - rank(b, style),
          )[0];
          if (!best) throw new Error(`Stuck at ${view.step.kind}.`);
          view = run.choose(best);
        }
        const { bossBelief } = readHiddenTruth(run);
        runs += 1;
        if (bossBelief < warmAt && bossBelief > coldAt) open += 1;
      }
    }

    expect(open / runs).toBeGreaterThan(0.7);
  });
});
