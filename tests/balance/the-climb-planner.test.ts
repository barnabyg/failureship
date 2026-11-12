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

  // Doing the Plans, for real or for show, and nothing else amoral, rarely
  // reaches the top: of these 200 deals the planner wins 7 and faking every
  // Plan 3, each seat by its Plan. The winning way is in ways-of-playing.
  it("is rarely reached by doing the Plans and little else", () => {
    const { wins, routes } = planner.whole();

    expect(wins).toBeGreaterThan(0);
    expect(wins).toBeLessThanOrEqual(10);
    expect([...routes.keys()]).toEqual(["plan > plan > plan"]);
    expect(forShow.whole().wins).toBeLessThanOrEqual(10);
  });
});
