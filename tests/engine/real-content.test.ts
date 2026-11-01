import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gameContent, parsePanelText, panelText } from "../../src/content";
import { startRun, type Choice, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Every way through the month, as the views seen along each one. */
function everyPath(seed: number): PlayerView[][] {
  const paths: PlayerView[][] = [];
  const walk = (script: Choice[]) => {
    const run = startRun({ seed, content: gameContent });
    const views = [run.view(), ...script.map((c) => run.choose(c))];
    const choices = views.at(-1)?.choices ?? [];
    if (choices.length === 0) paths.push(views);
    for (const choice of choices) walk([...script, choice]);
  };
  walk([]);
  return paths;
}

function isHolderSeed(seed: number, holder: string) {
  const run = startRun({ seed, content: gameContent });
  return readHiddenTruth(run).powerMap.holder === holder;
}

describe("the real month", () => {
  it("refuses panel text with a word missing", () => {
    const missingTitle = { ...panelText, title: undefined };

    expect(() => parsePanelText(missingTitle)).toThrow(/title/);
  });

  it("has no placeholder text in any data file", () => {
    const folder = path.join(import.meta.dirname, "../../content");
    for (const file of readdirSync(folder)) {
      const written = readFileSync(path.join(folder, file), "utf8");
      expect(written, file).not.toMatch(/placeholder|lorem|todo|tbc/i);
    }
  });

  it("always says what the player can do, and never reaches a dead end", () => {
    for (const seed of SEEDS.slice(0, 3)) {
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
    const facts = gameContent.hiddenTruth.facts.map((f) => f.text);
    for (const seed of SEEDS.slice(0, 3)) {
      for (const views of everyPath(seed)) {
        for (const view of views) {
          const seen = JSON.stringify(view);
          for (const fact of facts) expect(seen).not.toContain(fact);
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

  it("leaves the Power Map to be read from the signs alone", () => {
    const told = JSON.stringify([
      gameContent.officialStory,
      gameContent.moves,
      gameContent.scenes.map((s) => [s.narration, s.options]),
    ]);

    expect(told).not.toMatch(/\{(holder|ignored|bystander)\}/);
  });

  it("tells many different official stories", () => {
    const stories = new Set(
      everyPath(1).map((views) => JSON.stringify(views.at(-1)?.step)),
    );

    expect(stories.size).toBeGreaterThan(20);
  });

  it("gives every seed the same set of Characters, with a real holder", () => {
    const holders = new Set(
      SEEDS.map(
        (seed) =>
          readHiddenTruth(startRun({ seed, content: gameContent })).powerMap
            .holder,
      ),
    );

    expect(holders).toEqual(new Set(["boss", "analyst", "admin"]));
  });

  // The README names these seeds in its test scenario.
  it.each([
    [1, "boss"],
    [8, "analyst"],
    [5, "admin"],
  ])("keeps the seed %i documented for %s", (seed, holder) => {
    expect(isHolderSeed(seed, holder)).toBe(true);
  });
});
