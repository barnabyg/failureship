import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gameContent, parsePanelText, panelText } from "../../src/content";
import { startRun, type Choice, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const isFindOut = (choice: Choice) =>
  choice.type === "action" &&
  gameContent.actions.some(
    (a) => a.id === choice.actionId && a.findOut !== undefined,
  );

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
    // Every source and subject would multiply the paths and show nothing new.
    const choices =
      last?.step.kind === "find-out"
        ? last.choices.slice(0, 1)
        : (last?.choices ?? []);
    for (const choice of choices) walk([...script, choice]);
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
        const open = view.choices.filter((c) => !isFindOut(c));
        const choice = open[walk % open.length];
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

  // The browser tests rely on these two deals.
  it("keeps the deals that the Hidden Fact browser tests use", () => {
    const nature = (seed: number, character: string) => {
      const dealt = readHiddenTruth(
        startRun({ seed, content: gameContent }),
      ).characters.find((c) => c.id === character);
      return gameContent.hiddenTruth.facts.find((f) => f.id === dealt?.fact?.id)
        ?.nature;
    };
    const run = startRun({ seed: 22, content: gameContent });
    run.choose({
      type: "notification",
      notificationId: "report-or-pub",
      optionId: "report",
    });
    run.choose({ type: "continue" });
    run.choose({ type: "action", actionId: "inside-info" });
    const told = run.choose({
      type: "find-out",
      sourceId: "admin",
      subjectId: "boss",
    });

    expect(nature(3, "projects")).toBe("dangerous");
    expect(JSON.stringify(told.step)).toContain("abolished");
  });

  // The README contrasts these two seeds in its test scenario.
  it("keeps the two contrasting deals the README describes", () => {
    const of = (seed: number) => {
      const { characters } = readHiddenTruth(
        startRun({ seed, content: gameContent }),
      );
      return Object.fromEntries(
        characters.map((c) => {
          const fact = gameContent.hiddenTruth.facts.find(
            (f) => f.id === c.fact?.id,
          );
          return [c.id, { kind: c.kind, nature: fact?.nature ?? "none" }];
        }),
      );
    };

    expect(holderInMeeting(8)).toBe("boss");
    expect(holderInMeeting(5)).toBe("head");
    expect(of(8).projects?.nature).toBe("dangerous");
    expect(of(5).projects?.nature).toBe("none");
    expect(of(8).analyst?.nature).toBe("useful");
    expect(of(5).analyst?.nature).toBe("dangerous");
    expect(of(8).boss?.kind).toBe("incompetent");
    expect(of(5).boss?.kind).toBe("believer");
  });

  // Each of these holds influence in the meeting on that seed.
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
