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
}

/** Plays the first month, as far as its official story. */
function playThrough(run: Run) {
  let view = run.view();
  const views = [view];
  while (view.step.kind !== "story") {
    const next = view.choices[0];
    if (!next) break;
    view = run.choose(next);
    views.push(view);
  }
  return views;
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

  it("says why a place costing more than is left cannot be taken", () => {
    const raw = emptyMonthRaw();
    raw.balance.actionCosts.standard = 2;
    const run = startRun({ seed: 1, content: parseContent(raw) });
    spendAction(run, "kettle");

    expect(run.view().hotspots.find((h) => h.id === "desk")).toMatchObject({
      state: "unavailable",
      blockedBy: "BLOCKED-TOO-FEW 2 actions 1 action",
    });
  });

  it("says nothing is blocked while a place can be taken", () => {
    const view = startRun({ seed: 1, content: emptyMonth() }).view();

    expect(view.hotspots.every((h) => h.blockedBy === undefined)).toBe(true);
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

    expect(() => run.choose({ type: "action", actionId: "meeting" })).toThrow(
      /not available/i,
    );
    expect(run.view().hotspots.find((h) => h.id === "meeting")?.state).toBe(
      "done",
    );
  });

  it("runs in order: actions, then the official story", () => {
    const run = startRun({ seed: 1, content: emptyMonth() });

    const kinds = playThrough(run).map((v) => v.step.kind);

    expect(kinds).toEqual(["actions", "actions", "actions", "story"]);
  });

  it("gives the same outcome for the same seed and choices", () => {
    const script: Choice[] = [
      { type: "action", actionId: "desk" },
      { type: "action", actionId: "plant" },
      { type: "action", actionId: "kettle" },
    ];
    const play = (seed: number) => {
      const run = startRun({ seed, content: emptyMonth() });
      const views = script.map((choice) => run.choose(choice));
      return { views, truth: readHiddenTruth(run) };
    };

    expect(play(7)).toEqual(play(7));
  });

  it("deals the hidden truth from the seed", () => {
    const deals = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        JSON.stringify(
          readHiddenTruth(startRun({ seed, content: emptyMonth() })).characters,
        ),
      ),
    );

    expect(deals.size).toBeGreaterThan(1);
  });
});

describe("the player view", () => {
  it("never contains anything from the hidden truth", () => {
    const run = startRun({ seed: 3, content: emptyMonth() });
    const secrets = readHiddenTruth(run).characters.flatMap((c) =>
      c.fact ? [c.fact.text] : [],
    );
    expect(secrets.length).toBeGreaterThan(0);

    for (const view of playThrough(run)) {
      const seen = JSON.stringify(view);
      for (const secret of secrets) expect(seen).not.toContain(secret);
    }
  });
});
