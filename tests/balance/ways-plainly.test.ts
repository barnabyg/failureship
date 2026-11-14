import { expect, it } from "vitest";
import { playsTheWholeClimb, rate } from "./ways-survey";

playsTheWholeClimb(
  "plain and honest play up the whole climb",
  ["plain", "honest"],
  () => {
    // There is no route to the top without bad behaviour: honest play wins 3,
    // and plain play none. The planner, who fakes only Floor 1's Plan, is in
    // ways-plans.test.ts.
    it("takes nobody to the top without bad behaviour more than a handful of times", () => {
      expect(rate("honest", "won")).toBeLessThanOrEqual(0.03);
      expect(rate("plain", "won")).toBeLessThanOrEqual(0.03);
    });

    it("never fires a player who only plays plainly", () => {
      expect(rate("plain", "fired")).toBe(0);
      expect(rate("honest", "passedOver")).toBeGreaterThan(0);
    });

    // Doing the Plans for real never fires on these deals.
    it("rarely fires those who do the Plans", () => {
      expect(rate("honest", "fired")).toBeLessThanOrEqual(0.02);
    });
  },
);
