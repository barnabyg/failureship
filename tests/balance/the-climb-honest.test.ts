import { describe, expect, it } from "vitest";
import { HALVES, honest } from "./climb-survey";

describe("the climb to the top of Floor 3, doing every Plan for real", () => {
  it.each(HALVES.map((_, h) => h))("plays half the deals: half %i", (h) => {
    expect(honest.half(h)).toHaveLength(100);
  });

  it("is reachable within the run by a player who never fakes a Plan", () => {
    expect(honest.whole().wins).toBeGreaterThanOrEqual(15);
  });
});
