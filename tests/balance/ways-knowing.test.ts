import { expect, it } from "vitest";
import { playsTheWholeClimb, rate } from "./ways-survey";

// The ceiling of amoral play, which knows the hidden truth. Of these 100
// deals it wins 42, so at least the 0.40 that bounds reading well in
// ways-reads-well.test.ts, and is never fired.
playsTheWholeClimb("the amoral ceiling up the whole climb", ["knowing"], () => {
  it("takes the amoral ceiling to the top at least as often as reading well, and never fires it", () => {
    expect(rate("knowing", "won")).toBeGreaterThanOrEqual(0.4);
    expect(rate("knowing", "fired")).toBe(0);
    expect(rate("knowing", "passedOver")).toBeGreaterThan(0);
  });
});
