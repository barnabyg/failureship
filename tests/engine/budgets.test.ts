import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  startRun,
  type Choice,
  type Kind,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

const bossKind = (run: Run) =>
  readHiddenTruth(run).characters.find((c) => c.id === "boss")?.kind as Kind;

/** Plays for nothing until the given Notification arrives. */
function reach(run: Run, notificationId: string): PlayerView {
  let view = run.view();
  while (view.step.kind !== "results") {
    const { step } = view;
    if (step.kind === "notification" && step.id === notificationId) return view;
    const free =
      step.kind === "notification"
        ? step.options.find((o) => o.costLabel === "Costs nothing")
        : undefined;
    const next: Choice | undefined =
      step.kind === "notification" && free
        ? { type: "notification", notificationId: step.id, optionId: free.id }
        : view.choices[0];
    if (!next) throw new Error(`Stuck at ${step.kind}.`);
    view = run.choose(next);
  }
  throw new Error(`Never reached ${notificationId}.`);
}

/** The same Budget choice, for one seed: what the boss made of it. */
function decide(seed: number, notificationId: string, optionId: string) {
  const run = startRun({ seed, content: gameContent });
  reach(run, notificationId);
  const before = readHiddenTruth(run).bossOpinion;
  const { step } = run.choose({
    type: "notification",
    notificationId,
    optionId,
  });
  if (step.kind !== "notice") throw new Error(step.kind);
  return {
    kind: bossKind(run),
    shift: readHiddenTruth(run).bossOpinion - before,
    reaction: step.reaction,
  };
}

const DECISIONS = [
  ["bonus-pot", ["bonus-allies", "bonus-workers", "bonus-boss", "bonus-split"]],
  [
    "underspend",
    ["underspend-chairs", "underspend-project", "underspend-return"],
  ],
] as const;

describe("one-off Budgets", () => {
  it("offers at least two different decisions in a run", () => {
    for (const [id] of DECISIONS) {
      const run = startRun({ seed: 1, content: gameContent });
      const { step } = reach(run, id);
      if (step.kind !== "notification") throw new Error(step.kind);

      expect(step.options.length).toBeGreaterThan(2);
    }
    expect(
      gameContent.scenes.find((s) => s.id === "budget-round")?.options.length,
    ).toBeGreaterThan(2);
  });

  it.each(
    DECISIONS.flatMap(([id, options]) =>
      options.map((option) => [id, option] as const),
    ),
  )("lands %s %s differently with different boss kinds", (id, option) => {
    const landings = SEEDS.slice(0, 60).map((s) => decide(s, id, option));
    const byKind = (kind: Kind) => landings.filter((l) => l.kind === kind);

    expect(byKind("believer").length).toBeGreaterThan(0);
    expect(byKind("practitioner").length).toBeGreaterThan(0);
    expect(byKind("believer")[0]?.reaction).not.toEqual(
      byKind("incompetent")[0]?.reaction,
    );
    expect(new Set(landings.map((l) => l.shift)).size).toBeGreaterThan(1);
  });

  it("gives an ally's bonus a worse reception from a Believer", () => {
    const landings = SEEDS.map((s) => decide(s, "bonus-pot", "bonus-allies"));
    const of = (kind: Kind) =>
      landings.find((l) => l.kind === kind)?.shift ?? NaN;

    expect(of("believer")).toBeLessThan(0);
    expect(of("practitioner")).toBeGreaterThan(0);
  });

  it("has an immediate effect on the people involved", () => {
    for (const [id, options] of DECISIONS) {
      for (const optionId of options) {
        const written = gameContent.notifications
          .find((n) => n.id === id)
          ?.options.find((o) => o.id === optionId);

        expect(written?.result?.body, optionId).toBeTruthy();
        expect(written?.sets.length, optionId).toBeGreaterThan(0);
      }
    }
    // Paying the people who do the work does the work some good.
    const run = startRun({ seed: 1, content: gameContent });
    reach(run, "bonus-pot");
    const before = run.view().project.real;
    const after = run.choose({
      type: "notification",
      notificationId: "bonus-pot",
      optionId: "bonus-workers",
    }).project.real;
    const statuses = gameContent.project.statuses.map((s) => s.label);

    expect(statuses.indexOf(after)).toBeLessThanOrEqual(
      statuses.indexOf(before),
    );
  });

  it("keeps no balance or running total, on screen or in the rules", () => {
    const run = startRun({ seed: 1, content: gameContent });
    reach(run, "bonus-pot");
    const view = run.view();
    const money = /budget|balance|money|funds|remaining.*£|£/i;

    expect(Object.keys(view).filter((key) => money.test(key))).toEqual([]);
    expect(
      Object.keys(gameContent.balance).filter((key) =>
        /budget|money/i.test(key),
      ),
    ).toEqual([]);
    expect(JSON.stringify(view.step)).not.toMatch(/£\d|\$\d/);
    const truth = readHiddenTruth(run);
    expect(
      Object.keys(truth).filter((key) => /budget|money|funds/i.test(key)),
    ).toEqual([]);
  });

  it("does not remember a Budget decision into the next month", () => {
    const flagsGone = (optionId: string) => {
      const run = startRun({ seed: 1, content: gameContent });
      reach(run, "bonus-pot");
      run.choose({
        type: "notification",
        notificationId: "bonus-pot",
        optionId,
      });
      let view = run.view();
      const { month } = view;
      while (view.month === month) {
        const next = view.choices[0];
        if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
        view = run.choose(next);
      }
      return view.step.kind;
    };

    // Character memory of this belongs to Phase 4: the next month opens alike.
    expect(flagsGone("bonus-allies")).toBe(flagsGone("bonus-split"));
  });
});
