import { describe, expect, it } from "vitest";
import { HALVES, ridder } from "./climb-survey";

describe("the climb to the top of Floor 3, getting rid of bosses", () => {
  it.each(HALVES.map((_, h) => h))("plays half the deals: half %i", (h) => {
    expect(ridder.half(h)).toHaveLength(100);
  });

  it("is reachable within the run by getting rid of each boss above Floor 1", () => {
    const { routes } = ridder.whole();

    expect(routes.get("plan > ousted > ousted")?.length).toBeGreaterThan(0);
    for (const route of routes.keys()) expect(route).toMatch(/ousted$/);
  });
});
