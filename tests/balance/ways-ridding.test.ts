import { expect, it } from "vitest";
import { playsTheWholeClimb, rate } from "./ways-survey";

// Under a quarter of the 0.25 that bounds reading well in
// ways-reads-well.test.ts, so under a quarter of what reading well wins.
const FEW = 0.25 / 4;

playsTheWholeClimb(
  "getting rid of bosses up the whole climb",
  ["ridder", "engineer"],
  () => {
    it("takes neither to the top a quarter as often as reading well, and passes both over", () => {
      for (const name of ["ridder", "engineer"] as const) {
        expect(rate(name, "won"), name).toBeLessThan(FEW);
        expect(rate(name, "passedOver"), name).toBeGreaterThan(0);
      }
    });
  },
);
