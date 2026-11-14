import { expect, it } from "vitest";
import { monthsAfterDemotion, playsTheWholeClimb, rate } from "./ways-survey";

// Under a quarter of the 0.25 that bounds reading well in
// ways-reads-well.test.ts, so under a quarter of what reading well wins.
const FEW = 0.25 / 4;

playsTheWholeClimb(
  "blind amoral play and clicking about up the whole climb",
  ["amoral", "random"],
  () => {
    // Of these 100 deals, the amoral climber who picks its ways out at random
    // wins 4 and is fired on 71.
    it("fires an always amoral climber who picks its ways out blindly, and rarely takes it to the top", () => {
      expect(rate("amoral", "won")).toBeLessThanOrEqual(0.05);
      expect(rate("amoral", "fired")).toBeGreaterThan(0.5);
    });

    it("takes neither to the top a quarter as often as reading well, and passes both over", () => {
      for (const name of ["amoral", "random"] as const) {
        expect(rate(name, "won"), name).toBeLessThan(FEW);
        expect(rate(name, "passedOver"), name).toBeGreaterThan(0);
      }
    });

    // 34 and 9 months after a demotion here, and over 40 in
    // ways-reads-well.test.ts, so well over 50 in all.
    it("leaves a real choice after a demotion, over many months", () => {
      expect(monthsAfterDemotion()).toBeGreaterThan(20);
    });
  },
);
