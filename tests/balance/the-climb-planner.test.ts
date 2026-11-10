import { describe, expect, it } from "vitest";
import { HALVES, forShow, planner } from "./climb-survey";

describe("the climb to the top of Floor 3, by doing the Plans", () => {
  it.each(
    HALVES.flatMap((_, h) => [
      ["for real", planner, h] as const,
      ["for show", forShow, h] as const,
    ]),
  )("plays half the deals %s: half %i", (_, survey, h) => {
    expect(survey.half(h)).toHaveLength(100);
  });

  it("is reachable within the run by a planner, by doing every Plan", () => {
    const { wins, routes } = planner.whole();

    expect(wins).toBeGreaterThanOrEqual(30);
    expect(wins).toBeLessThanOrEqual(80);
    expect([...routes.keys()]).toEqual(["plan > plan > plan"]);
  });

  it("is reached much less often for show", () => {
    expect(forShow.whole().wins).toBeLessThanOrEqual(planner.whole().wins / 2);
  });
});
