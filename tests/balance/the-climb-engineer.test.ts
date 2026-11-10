import { describe, expect, it } from "vitest";
import { HALVES, engineer } from "./climb-survey";

describe("the climb to the top of Floor 3, getting rid of every boss", () => {
  it.each(HALVES.map((_, h) => h))("plays half the deals: half %i", (h) => {
    expect(engineer.half(h)).toHaveLength(100);
  });

  it("is reachable within the run by getting rid of every boss, Floor 1's too", () => {
    expect(
      engineer.whole().routes.get("ousted > ousted > ousted")?.length,
    ).toBeGreaterThan(0);
  });
});
