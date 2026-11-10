import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice } from "../../src/ui/later-month";
import { SEEDS } from "./styles";

/** Plays a whole run without a thought for what comes back. */
function playPlainly(seed: number) {
  const run = startRun({ seed, content: gameContent });
  let view = run.view();
  while (view.choices.length > 0) view = run.choose(plainChoice(view));
  if (view.step.kind !== "results") throw new Error("No results.");
  return { run, results: view.step };
}

describe("consequences have room to land", { timeout: 60_000 }, () => {
  it("brings back a Thread or lands a risk on a player who never thinks about it", () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const { run, results } = playPlainly(seed);
      const landed = readHiddenTruth(run).risks.filter((r) => r.cameOut);

      expect(
        results.threads.length + landed.length,
        String(seed),
      ).toBeGreaterThan(0);
    }
  });

  it("lets nearly every Thread started come back within the run", () => {
    let started = 0;
    let late = 0;
    for (const seed of SEEDS.slice(0, 100)) {
      const { run } = playPlainly(seed);
      const saved = JSON.parse(run.save()) as {
        state: { threads: { due: number | null }[] };
      };
      started += saved.state.threads.length;
      late += saved.state.threads.filter(
        (t) => (t.due ?? 0) > gameContent.balance.monthsPerRun,
      ).length;
    }

    expect(late / started).toBeLessThan(0.1);
  });

  it("does not fire a player who plays plainly", () => {
    for (const seed of SEEDS.slice(0, 100)) {
      expect(playPlainly(seed).results.ending.fired, String(seed)).toBe(false);
    }
  });
});
