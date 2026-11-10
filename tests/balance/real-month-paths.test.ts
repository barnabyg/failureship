import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { everyPath } from "../engine/month-paths";

const SEEDS = [1, 2, 3];

describe("the real month", () => {
  it("always says what the player can do, and never reaches a dead end", () => {
    for (const seed of SEEDS) {
      for (const views of everyPath(seed)) {
        for (const view of views) {
          expect(view.hint.trim()).not.toBe("");
          expect(view.hint).not.toMatch(/\{\w+\}/);
          if (view.step.kind !== "story") {
            expect(view.choices.length).toBeGreaterThan(0);
          }
        }
        expect(views.at(-1)?.step.kind).toBe("story");
        expect(views.map((v) => v.step.kind)).toContain("move");
      }
    }
  });

  it("never shows the hidden truth or an unfilled role on any path", () => {
    for (const seed of SEEDS) {
      const dealt = readHiddenTruth(startRun({ seed, content: gameContent }));
      const facts = dealt.characters.flatMap((c) =>
        c.fact ? [c.fact.text] : [],
      );
      // A claim can pass on a real fact, so asking is checked separately.
      const unasked = everyPath(seed).filter(
        (views) => !views.some((v) => v.step.kind === "find-out"),
      );
      for (const views of unasked) {
        for (const view of views) {
          const seen = JSON.stringify(view);
          for (const fact of facts) expect(seen).not.toContain(fact);
          expect(seen).not.toMatch(/Believer|Incompetent|Practitioner/);
          expect(seen).not.toContain("powerMap");
          expect(seen).not.toMatch(/\{(holder|ignored|bystander)\}/);
        }
      }
    }
  });

  it("never mentions the Buzzword to a player who did not go to the pub", () => {
    const paths = everyPath(1).filter(
      (views) => views.at(-1)?.buzzwords.length === 0,
    );
    expect(paths.length).toBeGreaterThan(0);
    for (const views of paths) {
      const seen = JSON.stringify(views.map((v) => v.step)).toLowerCase();
      expect(seen).not.toContain("strategic patience");
    }
  });
});
