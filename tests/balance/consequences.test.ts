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

/** The first hundred deals played plainly, once, for whichever test reads them first. */
let played: ReturnType<typeof playPlainly>[] | undefined;
const plainRuns = () =>
  (played ??= SEEDS.slice(0, 100).map((seed) => playPlainly(seed)));

// That plain play is never fired is in the ways-*.test.ts files.
describe("consequences have room to land", { timeout: 60_000 }, () => {
  it("brings back a Thread or lands a risk on a player who never thinks about it", () => {
    for (const [i, { run, results }] of plainRuns().entries()) {
      const landed = readHiddenTruth(run).risks.filter((r) => r.cameOut);

      expect(
        results.threads.length + landed.length,
        String(SEEDS[i]),
      ).toBeGreaterThan(0);
    }
  });

  it("lets nearly every Thread started come back within the run", () => {
    let started = 0;
    let late = 0;
    for (const { run } of plainRuns()) {
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
});
