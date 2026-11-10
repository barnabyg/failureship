import { describe, expect, it } from "vitest";
import type { Kind } from "../../src/engine";
import { DECISIONS, decide } from "../engine/budget-runs";

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe("one-off Budgets", () => {
  it.each(
    DECISIONS.flatMap(([id, options]) =>
      options.map((option) => [id, option] as const),
    ),
  )("lands %s %s differently with different boss kinds", (id, option) => {
    const landings = SEEDS.slice(0, 60).map((s) => decide(s, id, option));
    const byKind = (kind: Kind) => landings.filter((l) => l.kind === kind);

    expect(byKind("believer").length).toBeGreaterThan(0);
    expect(byKind("practitioner").length).toBeGreaterThan(0);
    expect(byKind("believer")[0]?.reaction).not.toEqual(
      byKind("incompetent")[0]?.reaction,
    );
    expect(new Set(landings.map((l) => l.shift)).size).toBeGreaterThan(1);
  });

  it("gives an ally's bonus a worse reception from a Believer", () => {
    const landings = SEEDS.map((s) => decide(s, "bonus-pot", "bonus-allies"));
    const of = (kind: Kind) =>
      landings.find((l) => l.kind === kind)?.shift ?? NaN;

    expect(of("believer")).toBeLessThan(0);
    expect(of("practitioner")).toBeGreaterThan(0);
  });
});
