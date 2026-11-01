import { describe, expect, it } from "vitest";
import { parseContent, startRun, type PlayerView } from "../../src/engine";
import { emptyMonthRaw } from "./fixture";

function priorityRaw() {
  const raw = emptyMonthRaw();
  raw.actions = raw.actions.map((a) =>
    a.id === "kettle" ? { ...a, sets: ["skipped"] } : a,
  ) as typeof raw.actions;
  raw.moves = [
    { id: "a", from: "A", title: "MOVE-A", body: "A." },
    { id: "b", from: "B", title: "MOVE-B", body: "B." },
    {
      id: "urgent",
      from: "U",
      title: "MOVE-URGENT",
      body: "U.",
      when: { flag: "skipped" },
      priority: true,
    },
  ];
  return raw;
}

/** The titles of the Moves that land in a run. */
function movesIn(seed: number, firstAction: string) {
  const run = startRun({ seed, content: parseContent(priorityRaw()) });
  const titles: string[] = [];
  let view: PlayerView = run.choose({ type: "action", actionId: firstAction });
  while (view.choices.length > 0) {
    if (view.step.kind === "move") titles.push(view.step.title);
    const choice =
      view.choices.find((c) => c.type === "continue") ??
      view.choices.find((c) => c.type === "action" && c.actionId === "desk");
    if (!choice) throw new Error("Stuck.");
    view = run.choose(choice);
  }
  return titles;
}

describe("a priority Move", () => {
  it("lands ahead of the others whenever its condition holds", () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(movesIn(seed, "kettle")[0]).toBe("MOVE-URGENT");
    }
  });

  it("does not land when its condition does not hold", () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(movesIn(seed, "desk")).not.toContain("MOVE-URGENT");
    }
  });
});
