import { describe, expect, it } from "vitest";
import { HALVES, honest } from "./climb-survey";

describe("the climb to the top of Floor 3, doing every Plan for real", () => {
  it.each(HALVES.map((_, h) => h))("plays half the deals: half %i", (h) => {
    expect(honest.half(h)).toHaveLength(100);
  });

  // There is no route to the top without bad behaviour: of these 200 deals,
  // a player who never fakes a Plan wins 3, under Believers all the way.
  it("is out of reach of a player who never fakes a Plan, but for a handful of deals", () => {
    expect(honest.whole().wins).toBeLessThanOrEqual(6);
  });
});
