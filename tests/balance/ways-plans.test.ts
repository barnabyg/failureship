import { expect, it } from "vitest";
import { playsTheWholeClimb, rate } from "./ways-survey";

// Under a quarter of the 0.25 that bounds reading well in
// ways-reads-well.test.ts, so under a quarter of what reading well wins.
const FEW = 0.25 / 4;

playsTheWholeClimb(
  "doing the Plans up the whole climb",
  ["planner", "forShow"],
  () => {
    // The planner, who fakes only Floor 1's Plan, wins 5, and faking every
    // Plan 2.
    it("takes nobody to the top without bad behaviour more than a handful of times", () => {
      expect(rate("planner", "won")).toBeLessThanOrEqual(0.05);
      for (const name of ["planner", "forShow"] as const) {
        expect(rate(name, "won"), name).toBeLessThan(FEW);
        expect(rate(name, "passedOver"), name).toBeGreaterThan(0);
      }
    });

    // Doing the Plans, for real or for show, never fires on these deals.
    it("rarely fires those who do the Plans", () => {
      for (const careful of ["planner", "forShow"] as const) {
        expect(rate(careful, "fired"), careful).toBeLessThanOrEqual(0.02);
      }
    });
  },
);
