import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { treatmentOf } from "./scene-view";

const GO: Choice = { type: "action", actionId: "boss-office" };
const catchUp = gameContent.scenes.find((s) => s.id === "catch-up");

/** Answers for nothing, until the player is free to act. */
function toFloor(run: Run): PlayerView {
  let view = run.view();
  while (view.step.kind !== "actions") {
    const { step } = view;
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
  return view;
}

const bossKind = (run: Run) =>
  readHiddenTruth(run).characters.find((c) => c.id === "boss")?.kind ?? "";

const isGo = (c: Choice) => c.type === "action" && c.actionId === GO.actionId;

describe("a catch-up in your boss's office", () => {
  it("has a room for your boss on every floor, which opens the catch-up", () => {
    for (const floor of gameContent.floors) {
      const rooms = new Set(floor.rooms.map((r) => r.id));
      const opens = gameContent.actions.filter(
        (a) => rooms.has(a.place) && a.scene === "catch-up",
      );
      expect(opens, floor.job).toHaveLength(1);
      expect(opens[0]?.label, floor.job).toBe("Your boss's office");
    }
  });

  it("sees your boss alone, who shows how they are with you, for an action", () => {
    const run = startRun({ seed: 2, content: gameContent });
    const before = toFloor(run);
    const view = run.choose(GO);
    if (view.step.kind !== "scene") throw new Error(view.step.kind);

    expect(view.step.id).toBe("catch-up");
    expect(view.step.people.map((p) => p.place)).toEqual(["boss"]);
    expect(view.step.people[0]?.behaviour).not.toBeNull();
    expect(treatmentOf(view.step)).not.toBeNull();
    expect(view.actions.remaining).toBe(before.actions.remaining - 1);
  });

  it("is open once a month", () => {
    const run = startRun({ seed: 2, content: gameContent });
    expect(toFloor(run).choices.some(isGo)).toBe(true);
    let view = run.choose(GO);
    while (view.step.kind !== "actions") {
      const next = view.choices[0];
      if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
      view = run.choose(next);
    }
    expect(view.choices.some(isGo)).toBe(false);
  });

  it.each(catchUp?.options.map((o) => [o.id, o] as const) ?? [])(
    "moves your boss's belief by their kind when you %s",
    (_id, option) => {
      const approach = gameContent.boss.approaches.find(
        (a) => a.id === option.results[0]?.approach,
      );
      expect(approach).toBeDefined();
      const seen = new Map<string, Set<string>>();
      for (let seed = 1; seen.size < 3 && seed <= 60; seed++) {
        const run = startRun({ seed, content: gameContent });
        toFloor(run);
        run.choose(GO);
        const kind = bossKind(run);
        const belief = readHiddenTruth(run).bossBelief;
        const after = run.choose({
          type: "scene",
          sceneId: "catch-up",
          optionId: option.id,
        });
        const shift = readHiddenTruth(run).bossBelief - belief;
        expect(shift, `seed ${String(seed)}`).toBe(
          approach?.shift[kind as keyof typeof approach.shift],
        );
        const said = JSON.stringify(after);
        const reaction =
          option.results[0]?.reaction?.[kind as "believer"] ?? "";
        expect(said, `seed ${String(seed)}`).toContain(reaction);
        seen.set(kind, (seen.get(kind) ?? new Set()).add(reaction));
      }
      expect([...seen.keys()].sort()).toEqual([
        "believer",
        "incompetent",
        "practitioner",
      ]);
    },
  );
});
