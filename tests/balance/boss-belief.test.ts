import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { SEEDS, rank, type Style } from "./styles";

// How a whole run ends for the boss's belief is in boss-approach.test.ts,
// which plays the runs it reads.
describe("the boss's belief stays worth reading", { timeout: 60_000 }, () => {
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
