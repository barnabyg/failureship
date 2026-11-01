import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  startRun,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { action, sceneFixtureRaw, sourcesRaw } from "./fixture";

function factsFixtureRaw() {
  const raw = sceneFixtureRaw();
  raw.hiddenTruth.charactersWithFact = 3;
  raw.hiddenTruth.facts = [
    { id: "bridge", text: "{name} DANGER-FACT", nature: "dangerous" },
    { id: "list", text: "{name} USEFUL-FACT", nature: "useful" },
    { id: "cat", text: "{name} IDLE-FACT" },
  ] as typeof raw.hiddenTruth.facts;
  raw.sources = sourcesRaw();
  raw.sources.methods[0] = {
    id: "ask",
    title: "Ask",
    prompt: "Whom?",
    sources: ["ana", "ben", "cal"],
    topics: { kind: 0, influence: 0, fact: 1 },
  };
  raw.scenes[0]?.options.push(
    {
      id: "blame-ben",
      label: "Blame Ben",
      results: [
        {
          when: { factNature: { character: "ben", nature: "dangerous" } },
          body: "BURNED",
          sets: ["burned"],
          factAt: "ben",
          factNote: "You blamed Ben, who had friends.",
        },
        { body: "GOT-AWAY-WITH-IT" },
      ],
    },
    {
      id: "use-list",
      label: "Offer {subject} help with the list",
      about: "list",
      results: [
        {
          when: { heardTrue: "list" },
          body: "PAID-OFF {subject}",
          factNote: "It was so about {subject}.",
        },
        {
          body: "FELL-FLAT {subject}",
          factNote: "It was never so about {subject}.",
        },
      ],
    },
  );
  const ask = {
    ...action("copier"),
    result: undefined,
    findOut: "ask",
  };
  return {
    ...raw,
    actions: raw.actions.map((a) => (a.id === "copier" ? ask : a)),
  };
}

const content = (): Content => parseContent(factsFixtureRaw());

function natureOf(run: Run, character: string, world: Content) {
  const dealt = readHiddenTruth(run).characters.find((c) => c.id === character);
  return world.hiddenTruth.facts.find((f) => f.id === dealt?.fact?.id)?.nature;
}

function openMeeting(run: Run) {
  return run.choose({ type: "action", actionId: "meeting" });
}

function optionIds(view: PlayerView) {
  if (view.step.kind !== "scene") throw new Error(view.step.kind);
  return view.step.options.map((o) => o.id);
}

function playOut(run: Run): PlayerView {
  let view = run.view();
  while (view.choices.length > 0) {
    const choice = view.choices.at(-1);
    if (!choice) break;
    view = run.choose(choice);
  }
  return view;
}

function resultsOf(view: PlayerView) {
  if (view.step.kind !== "results") throw new Error(view.step.kind);
  return view.step;
}

/** A seed and subject on which asking passes on the fact, truly or not. */
function hearsList(wantTrue: boolean, world: Content) {
  for (let seed = 1; seed < 3000; seed++) {
    for (const subjectId of ["ana", "cal"]) {
      const run = startRun({ seed, content: world });
      run.choose({ type: "action", actionId: "copier" });
      const view = run.choose({ type: "find-out", sourceId: "ben", subjectId });
      if (view.step.kind !== "claim") throw new Error(view.step.kind);
      if (!view.step.text.includes("USEFUL-FACT")) continue;
      if ((natureOf(run, subjectId, world) === "useful") === wantTrue) {
        run.choose({ type: "continue" });
        return { run, subjectId };
      }
    }
  }
  throw new Error("No seed passes that on.");
}

describe("a dangerous Hidden Fact", () => {
  it("gives the same choice a worse result when it has been dealt", () => {
    const world = content();
    const results = new Map<boolean, Set<string>>([
      [true, new Set()],
      [false, new Set()],
    ]);
    for (let seed = 1; seed <= 100; seed++) {
      const run = startRun({ seed, content: world });
      openMeeting(run);
      const dangerous = natureOf(run, "ben", world) === "dangerous";
      const view = run.choose({
        type: "scene",
        sceneId: "meeting",
        optionId: "blame-ben",
      });
      if (view.step.kind !== "notice") throw new Error(view.step.kind);
      results.get(dangerous)?.add(view.step.body);
    }

    expect(results.get(true)).toEqual(new Set(["BURNED"]));
    expect(results.get(false)).toEqual(new Set(["GOT-AWAY-WITH-IT"]));
  });

  it("is explained on the results screen when it has done its work", () => {
    const world = content();
    for (let seed = 1; seed <= 100; seed++) {
      const run = startRun({ seed, content: world });
      openMeeting(run);
      const dangerous = natureOf(run, "ben", world) === "dangerous";
      run.choose({ type: "scene", sceneId: "meeting", optionId: "blame-ben" });

      const { factEvents } = resultsOf(playOut(run));

      if (dangerous) {
        expect(factEvents).toEqual([
          {
            month: 1,
            note: "You blamed Ben, who had friends.",
            fact: "Ben Bird DANGER-FACT",
          },
        ]);
      } else {
        expect(factEvents).toEqual([]);
      }
    }
  });

  it("offers the same options whatever was dealt", () => {
    const world = content();
    const offered = new Set(
      Array.from({ length: 50 }, (_, i) =>
        optionIds(
          openMeeting(startRun({ seed: i + 1, content: world })),
        ).join(),
      ),
    );

    expect(offered.size).toBe(1);
  });
});

describe("a useful Hidden Fact", () => {
  it("offers nothing to a player who has not heard it", () => {
    const world = content();
    for (let seed = 1; seed <= 50; seed++) {
      const view = openMeeting(startRun({ seed, content: world }));
      expect(optionIds(view)).not.toContain("use-list");
    }
  });

  it("offers an option once the player has heard it", () => {
    const { run, subjectId } = hearsList(true, content());

    const view = openMeeting(run);

    expect(optionIds(view)).toContain("use-list");
    if (view.step.kind !== "scene") throw new Error(view.step.kind);
    const name = subjectId === "ana" ? "Ana Abel" : "Cal Cope";
    expect(view.step.options.map((o) => o.label)).toContain(
      `Offer ${name} help with the list`,
    );
  });

  it("pays off when what was heard is true", () => {
    const { run } = hearsList(true, content());
    openMeeting(run);

    const view = run.choose({
      type: "scene",
      sceneId: "meeting",
      optionId: "use-list",
    });

    if (view.step.kind !== "notice") throw new Error(view.step.kind);
    expect(view.step.body).toMatch(/^PAID-OFF/);
  });

  it("offers the option on a false claim too, which then falls flat", () => {
    const { run } = hearsList(false, content());

    expect(optionIds(openMeeting(run))).toContain("use-list");
    const view = run.choose({
      type: "scene",
      sceneId: "meeting",
      optionId: "use-list",
    });

    if (view.step.kind !== "notice") throw new Error(view.step.kind);
    expect(view.step.body).toMatch(/^FELL-FLAT/);
    const { factEvents } = resultsOf(playOut(run));
    expect(factEvents[0]?.note).toMatch(/never so/);
  });
});

describe("Hidden Facts in content", () => {
  it("rejects an option gated on a fact the player has not discovered", () => {
    const raw = factsFixtureRaw();
    const option = raw.scenes[0]?.options[0];
    if (option) {
      option.requires = { factNature: { character: "ben", nature: "useful" } };
    }

    expect(() => parseContent(raw)).toThrow(/hidden truth/);
  });

  it("rejects an option gated on whether what was heard is true", () => {
    const raw = factsFixtureRaw();
    const option = raw.scenes[0]?.options[0];
    if (option) option.requires = { not: { heardTrue: "list" } };

    expect(() => parseContent(raw)).toThrow(/hidden truth/);
  });

  it("rejects an option gated on a flag that only a hidden result sets", () => {
    const raw = factsFixtureRaw();
    const option = raw.scenes[0]?.options[0];
    if (option) option.requires = { flag: "burned" };

    expect(() => parseContent(raw)).toThrow(/hidden truth/);
  });

  it("allows an option gated on what the player has heard", () => {
    const raw = factsFixtureRaw();
    const option = raw.scenes[0]?.options[0];
    if (option) option.requires = { heardFact: "list" };

    expect(() => parseContent(raw)).not.toThrow();
  });

  it("rejects a reference to a Hidden Fact that does not exist", () => {
    const raw = factsFixtureRaw();
    const option = raw.scenes[0]?.options.find((o) => o.id === "use-list");
    if (option) option.about = "nothing";

    expect(() => parseContent(raw)).toThrow(/nothing/);
  });

  it("rejects {subject} in an option that is about no fact", () => {
    const raw = factsFixtureRaw();
    const option = raw.scenes[0]?.options[0];
    if (option) option.label = "Agree with {subject}";

    expect(() => parseContent(raw)).toThrow(/subject/);
  });
});

describe("the game's Hidden Facts", () => {
  it("has dangerous and useful ones, with some Scene reading each", () => {
    const natures = gameContent.hiddenTruth.facts.map((f) => f.nature);
    const written = JSON.stringify(gameContent.scenes);

    expect(natures).toContain("dangerous");
    expect(natures).toContain("useful");
    expect(written).toContain("factNature");
    expect(written).toContain('"about"');
    for (const fact of gameContent.hiddenTruth.facts) {
      if (fact.nature === "useful") expect(written).toContain(fact.id);
    }
  });

  it("gives a useful fact's option only to someone who has heard of it", () => {
    const usefulIds = gameContent.hiddenTruth.facts
      .filter((f) => f.nature === "useful")
      .map((f) => f.id);
    const gated = gameContent.scenes.flatMap((s) =>
      s.options.filter((o) => o.about !== undefined),
    );

    expect(new Set(gated.map((o) => o.about))).toEqual(new Set(usefulIds));
  });
});
