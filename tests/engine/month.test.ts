import { describe, expect, it } from "vitest";
import {
  parseContent,
  startRun,
  type Choice,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { emptyMonth, emptyMonthRaw, sceneFixture } from "./fixture";

function spendAction(run: Run, actionId: string) {
  run.choose({ type: "action", actionId });
  run.choose({ type: "continue" });
}

function playThrough(run: Run) {
  const views = [run.view()];
  for (;;) {
    const next = views.at(-1)?.choices[0];
    if (!next) return views;
    views.push(run.choose(next));
  }
}

describe("a month", () => {
  it("starts with three actions to spend on the floor", () => {
    const view = startRun({ seed: 1, content: emptyMonth() }).view();

    expect(view.step.kind).toBe("actions");
    expect(view.actions).toMatchObject({ total: 3, spent: 0, remaining: 3 });
    expect(view.hotspots.map((h) => h.id)).toEqual([
      "kettle",
      "desk",
      "copier",
      "plant",
    ]);
  });

  it("takes the number of actions from balance data", () => {
    const raw = emptyMonthRaw();
    raw.balance.actionsPerMonth = 2;
    const run = startRun({ seed: 1, content: parseContent(raw) });

    spendAction(run, "kettle");
    spendAction(run, "desk");

    expect(run.view().step.kind).toBe("story");
  });

  it("refuses a fourth action in the same month", () => {
    const run = startRun({ seed: 1, content: emptyMonth() });
    spendAction(run, "kettle");
    spendAction(run, "desk");
    spendAction(run, "copier");

    expect(() => run.choose({ type: "action", actionId: "plant" })).toThrow(
      /not available/i,
    );
    expect(run.view().actions.remaining).toBe(0);
  });

  it("lets a place be visited again this month", () => {
    const run = startRun({ seed: 1, content: emptyMonth() });
    spendAction(run, "kettle");
    spendAction(run, "kettle");

    expect(run.view().actions.remaining).toBe(1);
    expect(run.view().hotspots.find((h) => h.id === "kettle")?.state).toBe(
      "available",
    );
  });

  it("spends every action, however many balance data gives", () => {
    const raw = emptyMonthRaw();
    raw.balance.actionsPerMonth = 6;
    const run = startRun({ seed: 1, content: parseContent(raw) });

    for (let spent = 0; spent < 6; spent++) spendAction(run, "kettle");

    expect(run.view().actions.remaining).toBe(0);
    expect(run.view().step.kind).toBe("story");
  });

  it("will not reopen a place that is once a month", () => {
    const run = startRun({ seed: 1, content: sceneFixture() });
    run.choose({ type: "action", actionId: "meeting" });
    run.choose({ type: "scene", sceneId: "meeting", optionId: "stay-quiet" });
    run.choose({ type: "continue" });

    expect(() => run.choose({ type: "action", actionId: "meeting" })).toThrow(
      /not available/i,
    );
    expect(run.view().hotspots.find((h) => h.id === "meeting")?.state).toBe(
      "done",
    );
  });

  it("will not take an action while a result is waiting to be read", () => {
    const run = startRun({ seed: 1, content: emptyMonth() });
    run.choose({ type: "action", actionId: "kettle" });

    expect(run.view().step.kind).toBe("notice");
    expect(() => run.choose({ type: "action", actionId: "desk" })).toThrow(
      /not available/i,
    );
  });

  it("runs in order: actions, then the official story, then nothing", () => {
    const run = startRun({ seed: 1, content: emptyMonth() });

    const kinds = playThrough(run).map((v) => v.step.kind);

    expect(kinds).toEqual([
      "actions",
      "notice",
      "actions",
      "notice",
      "actions",
      "notice",
      "story",
    ]);
    expect(run.view().choices).toEqual([]);
  });

  it("gives the same outcome for the same seed and choices", () => {
    const script: Choice[] = [
      { type: "action", actionId: "desk" },
      { type: "continue" },
      { type: "action", actionId: "plant" },
      { type: "continue" },
      { type: "action", actionId: "kettle" },
      { type: "continue" },
    ];
    const play = (seed: number) => {
      const run = startRun({ seed, content: emptyMonth() });
      const views = script.map((choice) => run.choose(choice));
      return { views, truth: readHiddenTruth(run) };
    };

    expect(play(7)).toEqual(play(7));
  });

  it("deals the hidden truth from the seed", () => {
    const facts = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map(
        (seed) =>
          readHiddenTruth(startRun({ seed, content: emptyMonth() })).fact.id,
      ),
    );

    expect(facts.size).toBeGreaterThan(1);
  });
});

describe("the player view", () => {
  it("never contains anything from the hidden truth", () => {
    const secrets = emptyMonth().hiddenTruth.facts.map((f) => f.text);
    const run = startRun({ seed: 3, content: emptyMonth() });

    for (const view of playThrough(run)) {
      const seen = JSON.stringify(view);
      for (const secret of secrets) expect(seen).not.toContain(secret);
    }
    expect(secrets).toContain(readHiddenTruth(run).fact.text);
  });
});
