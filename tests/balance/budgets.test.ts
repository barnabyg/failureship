import { describe, expect, it } from "vitest";
import { KINDS, type Kind } from "../../src/engine";
import { DECISIONS, decide } from "../engine/budget-runs";

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

/**
 * The same Budget choice on the deals in turn, up to `most` of them, until it
 * has landed on a boss of each kind. The tests read the first landing on each
 * kind, so the deals after it would say nothing more.
 */
function landingsOn(id: string, option: string, most: number) {
  const landings: ReturnType<typeof decide>[] = [];
  for (const seed of SEEDS.slice(0, most)) {
    landings.push(decide(seed, id, option));
    if (KINDS.every((kind) => landings.some((l) => l.kind === kind))) break;
  }
  return landings;
}

describe("one-off Budgets", () => {
  it.each(
    DECISIONS.flatMap(([id, options]) =>
      options.map((option) => [id, option] as const),
    ),
  )("lands %s %s differently with different boss kinds", (id, option) => {
    const landings = landingsOn(id, option, 60);
    const byKind = (kind: Kind) => landings.filter((l) => l.kind === kind);

    expect(byKind("believer").length).toBeGreaterThan(0);
    expect(byKind("practitioner").length).toBeGreaterThan(0);
    expect(byKind("believer")[0]?.reaction).not.toEqual(
      byKind("incompetent")[0]?.reaction,
    );
    expect(new Set(landings.map((l) => l.shift)).size).toBeGreaterThan(1);
  });

  it("gives an ally's bonus a worse reception from a Believer", () => {
    const landings = landingsOn("bonus-pot", "bonus-allies", 200);
    const of = (kind: Kind) =>
      landings.find((l) => l.kind === kind)?.shift ?? NaN;

    expect(of("believer")).toBeLessThan(0);
    expect(of("practitioner")).toBeGreaterThan(0);
  });
});
