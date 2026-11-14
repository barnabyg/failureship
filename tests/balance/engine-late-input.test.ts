import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { KINDS, startRun, type Kind } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { lateInMonthTwo } from "../engine/late-input";

const SEEDS = Array.from({ length: 600 }, (_, i) => i + 1);

function colleagueKind(seed: number): Kind {
  const run = startRun({ seed, content: gameContent });
  const kind = readHiddenTruth(run).characters.find(
    (c) => c.id === gameContent.project.input?.character,
  )?.kind;
  if (kind === undefined) throw new Error("No colleague was dealt.");
  return kind;
}

// Found once, for both tests.
let lateFound: Set<number> | undefined;
const lateSeeds = () => (lateFound ??= new Set(SEEDS.filter(lateInMonthTwo)));

describe("late input for the report, over many seeds", () => {
  it("comes in some months and not others", () => {
    const late = lateSeeds();

    expect(late.size).toBeGreaterThan(SEEDS.length / 10);
    expect(late.size).toBeLessThan(SEEDS.length * 0.9);
  });

  it("is more likely from some kinds, without settling which kind someone is", () => {
    const late = lateSeeds();
    const rates = Object.fromEntries(
      KINDS.map((kind) => {
        const dealt = SEEDS.filter((seed) => colleagueKind(seed) === kind);
        return [kind, dealt.filter((s) => late.has(s)).length / dealt.length];
      }),
    ) as Record<Kind, number>;

    expect(rates.incompetent).toBeGreaterThan(rates.believer);
    expect(rates.practitioner).toBeGreaterThan(rates.believer);
    for (const kind of KINDS) {
      expect(rates[kind], kind).toBeGreaterThan(0);
      expect(rates[kind], kind).toBeLessThan(1);
    }
  });
});
