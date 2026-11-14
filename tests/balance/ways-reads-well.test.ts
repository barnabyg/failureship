import { expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  hintsSeen,
  monthsAfterDemotion,
  monthsOnFloor,
  playsTheWholeClimb,
  rate,
} from "./ways-survey";

// The winning way: mostly amoral, reading well from the player view. The other
// ways of playing are in the other ways-*.test.ts files, each with its own
// tally, so the bounds there that compare a way with this one go by this
// file's 0.40 cap: under a quarter of it to the top (FEW in ways-survey.ts),
// or at least it for the ceiling.
playsTheWholeClimb("reading well up the whole climb", ["readsWell"], () => {
  // Of these 100 deals, reading well and mostly amoral wins 39, and the
  // amoral ceiling, which knows the hidden truth, 42. A person will likely
  // win less.
  it("takes a mostly amoral player who reads well to the top most often, short of the ceiling", () => {
    expect(rate("readsWell", "won")).toBeGreaterThanOrEqual(0.25);
    expect(rate("readsWell", "won")).toBeLessThanOrEqual(0.4);
    expect(rate("readsWell", "passedOver")).toBeGreaterThan(0);
  });

  // A big mistake demotes the reader on 8, who climbs back by not making it
  // again.
  it("demotes after a big mistake, and rarely fires", () => {
    expect(rate("readsWell", "demoted")).toBeGreaterThan(0.05);
    expect(rate("readsWell", "fired")).toBeLessThan(0.1);
  });

  // This way alone reaches every step there is a hint for, from a
  // Notification to the win, and every floor.
  it("shows every hint, and plays every floor", () => {
    expect(hintsSeen()).toEqual(Object.keys(gameContent.ui.hints).sort());
    for (const { job } of gameContent.floors) {
      expect(monthsOnFloor(job), job).toBeGreaterThan(100);
    }
  });

  // 47 months after a demotion here, and over 20 in ways-amoral.test.ts, so
  // well over 50 in all.
  it("leaves a real choice after a demotion, over many months", () => {
    expect(monthsAfterDemotion()).toBeGreaterThan(40);
  });
});
