import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  IllegalChoiceError,
  parseContent,
  startRun,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { findOutFixtureRaw } from "./fixture";

const content = () => parseContent(findOutFixtureRaw());

function askOnce(run: Run, sourceId = "ben", subjectId = "cal") {
  run.choose({ type: "action", actionId: "copier" });
  return run.choose({ type: "find-out", sourceId, subjectId });
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

/** What one source told the player, on each seed, with its verdict. */
function verdictsByKind(world: Content, seeds = 1500) {
  const tally = {
    believer: new Map<string, number>(),
    incompetent: new Map<string, number>(),
    practitioner: new Map<string, number>(),
  };
  for (let seed = 1; seed <= seeds; seed++) {
    const run = startRun({ seed, content: world });
    askOnce(run);
    const kind = readHiddenTruth(run).characters.find(
      (c) => c.id === "ben",
    )?.kind;
    if (!kind) throw new Error("No such source.");
    const [claim] = resultsOf(playOut(run)).claims;
    if (!claim) throw new Error("No claim.");
    tally[kind].set(claim.verdict, (tally[kind].get(claim.verdict) ?? 0) + 1);
  }
  return tally;
}

function rate(counts: Map<string, number>, verdict: string) {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  return (counts.get(verdict) ?? 0) / total;
}

describe("Find Out", () => {
  it("costs an action, just as acting does", () => {
    const run = startRun({ seed: 1, content: content() });
    expect(run.view().actions.remaining).toBe(3);

    const view = run.choose({ type: "action", actionId: "copier" });

    expect(view.actions.remaining).toBe(2);
    expect(view.step.kind).toBe("find-out");
  });

  it("lets the player pick the source and the subject", () => {
    const run = startRun({ seed: 1, content: content() });

    const view = run.choose({ type: "action", actionId: "copier" });

    if (view.step.kind !== "find-out") throw new Error(view.step.kind);
    expect(view.step.sources.map((s) => s.name)).toEqual([
      "Ana Abel",
      "Ben Bird",
      "Cal Cope",
    ]);
    expect(view.choices).toHaveLength(6);
  });

  it("refuses to ask someone about themselves", () => {
    const run = startRun({ seed: 1, content: content() });
    run.choose({ type: "action", actionId: "copier" });

    expect(() =>
      run.choose({ type: "find-out", sourceId: "ben", subjectId: "ben" }),
    ).toThrow(IllegalChoiceError);
  });

  it("shows the claim and who made it", () => {
    const run = startRun({ seed: 1, content: content() });

    const view = askOnce(run);

    if (view.step.kind !== "claim") throw new Error(view.step.kind);
    expect(view.step.source).toBe("Ben Bird");
    expect(view.step.text).toMatch(/Cal Cope|HEARD/);
    expect(view.step.text).not.toMatch(/\{\w+\}/);
    expect(view.choices).toEqual([{ type: "continue" }]);
  });

  it("is the same again for the same seed and choices", () => {
    const told = (seed: number) =>
      askOnce(startRun({ seed, content: content() })).step;

    for (const seed of [1, 2, 3, 4]) expect(told(seed)).toEqual(told(seed));
  });

  it("never says whether a claim is true before the run ends", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const run = startRun({ seed, content: content() });
      const seen = JSON.stringify([
        askOnce(run),
        run.choose({ type: "continue" }),
      ]);

      expect(seen).not.toMatch(/VERDICT|"status"|mistaken|outOfDate/);
    }
  });

  it("words every status alike, so that wording gives nothing away", () => {
    const { claims } = findOutFixtureRaw().sources;
    const said = new Map<string, Set<string>>();
    for (let seed = 1; seed <= 1500; seed++) {
      const run = startRun({ seed, content: content() });
      const view = askOnce(run);
      if (view.step.kind !== "claim") throw new Error(view.step.kind);
      const [{ verdict } = { verdict: "" }] = resultsOf(playOut(run)).claims;
      const set = said.get(view.step.text) ?? new Set();
      said.set(view.step.text, set.add(verdict));
    }

    expect(claims.kind.believer).toHaveLength(1);
    expect([...said.values()].some((v) => v.size > 1)).toBe(true);
    expect(said.get("Cal Cope SAID-HIGH")?.size).toBeGreaterThan(1);
  });

  it("makes each kind of source reliable in its own way", () => {
    const tally = verdictsByKind(content());

    expect(rate(tally.believer, "VERDICT-TRUE")).toBeGreaterThan(
      rate(tally.incompetent, "VERDICT-TRUE") * 1.5,
    );
    expect(rate(tally.incompetent, "VERDICT-MISTAKEN")).toBeGreaterThan(
      rate(tally.practitioner, "VERDICT-MISTAKEN") + 0.3,
    );
    expect(rate(tally.practitioner, "VERDICT-FALSE")).toBeGreaterThan(0.4);
    expect(rate(tally.believer, "VERDICT-FALSE")).toBe(0);
  });

  it("shifts with what the source wants, dealt from the seed", () => {
    const raw = findOutFixtureRaw();
    raw.sources.motives = [
      {
        id: "spite",
        text: "{name} was spiteful.",
        adjust: { true: 0, mistaken: 0, outOfDate: 0, false: 30 },
      },
    ];

    const tally = verdictsByKind(parseContent(raw));

    expect(rate(tally.believer, "VERDICT-FALSE")).toBeGreaterThan(0.5);
  });

  it("deals motives per Character, which can vary by seed", () => {
    const raw = findOutFixtureRaw();
    const adjust = { true: 0, mistaken: 0, outOfDate: 0, false: 0 };
    raw.sources.motives = [
      { id: "a", text: "{name} A", adjust },
      { id: "b", text: "{name} B", adjust },
    ];
    const world = parseContent(raw);

    const dealt = new Set(
      Array.from({ length: 40 }, (_, i) =>
        readHiddenTruth(startRun({ seed: i + 1, content: world }))
          .characters.map((c) => c.motive)
          .join(),
      ),
    );

    expect(dealt.size).toBeGreaterThan(1);
  });

  it("shows each claim and its truth on the results screen", () => {
    const run = startRun({ seed: 1, content: content() });
    const view = askOnce(run);
    if (view.step.kind !== "claim") throw new Error(view.step.kind);

    const [claim] = resultsOf(playOut(run)).claims;

    expect(claim).toMatchObject({
      month: 1,
      source: "Ben Bird",
      text: view.step.text,
      motive: "Ben Bird had no reason.",
    });
    expect(claim?.verdict).toMatch(/^VERDICT-/);
  });
});

describe("sources in content", () => {
  it("rejects a source who is not a Character", () => {
    const raw = findOutFixtureRaw();
    raw.sources.methods[0]?.sources.push("nobody");

    expect(() => parseContent(raw)).toThrow(/nobody/);
  });

  it("rejects a Find Out that does not exist", () => {
    const raw = findOutFixtureRaw();
    raw.actions = raw.actions.map((a) =>
      a.id === "copier" ? { ...a, findOut: "nothing" } : a,
    );

    expect(() => parseContent(raw)).toThrow(/nothing/);
  });

  it("rejects a source who can only ever say one sort of thing", () => {
    const raw = findOutFixtureRaw();
    raw.sources.reliability.believer = {
      true: 1,
      mistaken: 0,
      outOfDate: 0,
      false: 0,
    };

    expect(() => parseContent(raw)).toThrow(/believer/);
  });

  it("rejects a claim with nobody to be about", () => {
    const raw = findOutFixtureRaw();
    raw.sources.claims.influence.high = ["Somebody decides."];

    expect(() => parseContent(raw)).toThrow(/\{subject\}/);
  });

  it("rejects a claim wording that gives away a token it cannot fill", () => {
    const raw = findOutFixtureRaw();
    raw.sources.claims.fact = ["{fact} says {source}."];

    expect(() => parseContent(raw)).toThrow(/source/);
  });
});

describe("the game's sources", () => {
  it("offers Find Out in every month", () => {
    for (let month = 1; month <= gameContent.balance.monthsPerRun; month++) {
      const open = gameContent.actions.filter(
        (a) =>
          a.findOut !== undefined &&
          (a.months === undefined || a.months.includes(month)),
      );
      expect(open.length, `month ${String(month)}`).toBeGreaterThan(0);
    }
  });

  it("offers both asking and buying", () => {
    expect(gameContent.sources.methods.map((m) => m.id)).toEqual([
      "ask",
      "buy",
    ]);
  });

  it("never names a kind in the words of a claim", () => {
    const told = JSON.stringify(gameContent.sources.claims);

    expect(told).not.toMatch(/Believer|Incompetent|Practitioner/);
  });
});
