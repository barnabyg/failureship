import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gameContent, parsePanelText, panelText } from "../../src/content";
import { startRun, type Choice, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Every way through the first month, as the views seen along each one. */
function everyPath(seed: number): PlayerView[][] {
  const paths: PlayerView[][] = [];
  const walk = (script: Choice[]) => {
    const run = startRun({ seed, content: gameContent });
    const views = [run.view(), ...script.map((c) => run.choose(c))];
    const last = views.at(-1);
    if (last?.step.kind === "story") {
      paths.push(views);
      return;
    }
    for (const choice of last?.choices ?? []) walk([...script, choice]);
  };
  walk([]);
  return paths;
}

/** Who holds influence among the people in the meeting, on this deal. */
function holderInMeeting(seed: number) {
  const run = startRun({ seed, content: gameContent });
  const meeting = gameContent.scenes.find((s) => s.id === "meeting");
  return readHiddenTruth(run).powerMap.order.find((id) =>
    meeting?.cast.includes(id),
  );
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
    for (const seed of SEEDS.slice(0, 3)) {
      const dealt = readHiddenTruth(startRun({ seed, content: gameContent }));
      const facts = dealt.characters.flatMap((c) =>
        c.fact ? [c.fact.text] : [],
      );
      for (const views of everyPath(seed)) {
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

  it("leaves the Power Map to be read from the signs alone", () => {
    const told = JSON.stringify([
      gameContent.officialStory,
      gameContent.moves,
      gameContent.scenes.map((s) => [s.narration, s.options]),
    ]);

    expect(told).not.toMatch(/\{(holder|ignored|bystander)\}/);
  });

  it("never shows a dealt kind or Hidden Fact before the end of a run", () => {
    for (const seed of SEEDS) {
      const run = startRun({ seed, content: gameContent });
      const { characters } = readHiddenTruth(run);
      let view = run.view();
      let walk = seed;
      while (view.step.kind !== "results") {
        const seen = JSON.stringify(view);
        expect(seen).not.toMatch(/Believer|Incompetent|Practitioner/i);
        expect(seen).not.toContain("powerMap");
        for (const { fact } of characters) {
          if (fact) expect(seen).not.toContain(fact.text);
        }
        walk = (walk * 31 + 7) % 1009;
        const choice = view.choices[walk % view.choices.length];
        if (!choice) throw new Error(`Stuck at ${view.step.kind}.`);
        view = run.choose(choice);
      }
    }
  });

  it("reveals every Character at the end of a run", () => {
    const run = startRun({ seed: 2, content: gameContent });
    let view = run.view();
    for (;;) {
      const choice = view.choices.at(-1);
      if (!choice) break;
      view = run.choose(choice);
    }

    expect(view.step).toMatchObject({ kind: "results" });
    if (view.step.kind !== "results") throw new Error(view.step.kind);
    expect(view.step.characters).toHaveLength(5);
    expect(view.step.characters.filter((c) => c.fact !== null)).toHaveLength(4);
    expect(JSON.stringify(view)).not.toMatch(/\{\w+\}/);
  });

  it("tells many different official stories", () => {
    const stories = new Set(
      everyPath(1).map((views) => JSON.stringify(views.at(-1)?.step)),
    );

    expect(stories.size).toBeGreaterThan(20);
  });

  it("lets the player watch every Character, whose kind the results reveal", () => {
    const present = new Set(gameContent.scenes.flatMap((s) => s.cast));

    expect(present).toEqual(new Set(gameContent.characters.map((c) => c.id)));
  });

  it("never has the meeting's holder below anyone on the true Power Map", () => {
    const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
    for (const seed of seeds) {
      const run = startRun({ seed, content: gameContent });
      const { influence } = readHiddenTruth(run).powerMap;

      expect(influence.map((i) => i.over)).not.toContain(holderInMeeting(seed));
    }
  });

  it("lets anyone in the meeting hold influence, depending on the deal", () => {
    const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
    const holders = new Set(seeds.map(holderInMeeting));

    expect(holders).toEqual(
      new Set(["head", "boss", "analyst", "admin", "projects"]),
    );
  });

  it("gives every Character a place on one Org Chart", () => {
    const { orgChart } = startRun({ seed: 1, content: gameContent }).view();

    expect(orgChart).toHaveLength(5);
    expect(orgChart.filter((e) => e.reportsTo === null)).toHaveLength(1);
  });

  // The README names these seeds in its test scenario.
  it.each([
    [8, "boss"],
    [1, "analyst"],
    [6, "admin"],
    [2, "projects"],
    [4, "head"],
  ])("keeps the seed %i documented for %s", (seed, holder) => {
    expect(holderInMeeting(seed)).toBe(holder);
  });
});
