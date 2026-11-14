import { expect, it } from "vitest";
import { FEW, playsTheWholeClimb, rate } from "./ways-survey";

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
