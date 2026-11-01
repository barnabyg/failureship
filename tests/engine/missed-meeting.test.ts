import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";

const isMeeting = (c: Choice) =>
  c.type === "action" && c.actionId.startsWith("meeting");

/** Answers Notifications for nothing, and spends actions as told, to month's end. */
function playMonth(run: Run, attend: boolean): PlayerView[] {
  const views: PlayerView[] = [];
  let view = run.view();
  const { month } = view;
  while (view.month === month && view.step.kind !== "results") {
    const { step } = view;
    const free =
      step.kind === "notification"
        ? step.options.find((o) => o.costLabel === "Costs nothing")
        : undefined;
    const meeting = view.choices.find(isMeeting);
    const notMeeting = view.choices.filter((c) => !isMeeting(c));
    let next: Choice | undefined = attend
      ? (meeting ?? view.choices[0])
      : notMeeting[0];
    if (step.kind === "notification" && free) {
      next = {
        type: "notification",
        notificationId: step.id,
        optionId: free.id,
      };
    }
    if (!next) throw new Error(`Stuck at ${step.kind}.`);
    view = run.choose(next);
    views.push(view);
  }
  return views;
}

const missedIds = () =>
  gameContent.demands?.missed?.actions.map((a) => a.id) ?? [];

describe("a meeting you do not go to", () => {
  it("offers a meeting to skip in every month", () => {
    const { attended } = gameContent.demands?.missed ?? { attended: "" };
    for (let m = 1; m <= gameContent.balance.monthsPerRun; m++) {
      const meetings = gameContent.actions.filter(
        (a) => a.sets.includes(attended) && a.months?.includes(m),
      );
      expect(meetings, `month ${String(m)}`).toHaveLength(1);
    }
  });

  it("leaves an open Demand that arrives next month, with the five answers", () => {
    const run = startRun({ seed: 2, content: gameContent });
    const first = playMonth(run, false);
    expect(first.at(-1)?.openDemands).toHaveLength(1);

    const seen: string[] = [];
    let view = run.view();
    while (view.month === 2 && view.step.kind !== "actions") {
      const { step } = view;
      if (step.kind === "notification") {
        seen.push(step.id);
        if (missedIds().includes(step.id)) {
          expect(step.options.map((o) => o.id)).toEqual([
            "deliver",
            "push-back",
            "hand-off",
            "fake",
            "stall",
          ]);
        }
        const optionId = step.options.find(
          (o) => o.costLabel === "Costs nothing",
        )?.id;
        if (optionId === undefined) throw new Error("Nothing free.");
        view = run.choose({
          type: "notification",
          notificationId: step.id,
          optionId,
        });
      } else {
        const next = view.choices[0];
        if (!next) throw new Error(`Stuck at ${step.kind}.`);
        view = run.choose(next);
      }
    }

    expect(seen.filter((id) => missedIds().includes(id))).toHaveLength(1);
  });

  it("leaves nothing when you do go", () => {
    const run = startRun({ seed: 2, content: gameContent });
    const first = playMonth(run, true);

    expect(first.at(-1)?.openDemands).toEqual([]);
    expect(
      JSON.stringify(first).includes("The minutes have been circulated"),
    ).toBe(false);
  });

  it("gives a Demand for every meeting missed, never the same one twice", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const run = startRun({ seed, content: gameContent });
      const told: string[] = [];
      for (let m = 1; m <= gameContent.balance.monthsPerRun; m++) {
        for (const view of playMonth(run, false)) {
          if (view.step.kind === "notice" && view.month === m) {
            const known = gameContent.demands?.missed?.actions.find(
              (a) => a.title === (view.step as { title: string }).title,
            );
            if (known) told.push(known.id);
          }
        }
      }
      expect(told, `seed ${String(seed)}`).toHaveLength(
        gameContent.balance.monthsPerRun,
      );
      expect(new Set(told).size).toBe(told.length);
    }
  });

  it("saves the action that the meeting would have cost", () => {
    const leftAfterFirstFloorChoice = (attend: boolean) => {
      const run = startRun({ seed: 3, content: gameContent });
      let view = run.view();
      while (view.step.kind !== "actions") {
        const { step } = view;
        const free =
          step.kind === "notification"
            ? step.options.find((o) => o.costLabel === "Costs nothing")
            : undefined;
        const next: Choice | undefined =
          step.kind === "notification" && free
            ? {
                type: "notification",
                notificationId: step.id,
                optionId: free.id,
              }
            : view.choices[0];
        if (!next) throw new Error(`Stuck at ${step.kind}.`);
        view = run.choose(next);
      }
      const visits = attend ? ["meeting", "kitchen"] : ["kitchen"];
      for (const actionId of visits) {
        view = run.choose({ type: "action", actionId });
        const next = view.choices[0];
        if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
        view = run.choose(next);
        if (view.step.kind === "notice")
          view = run.choose({ type: "continue" });
      }
      return view.actions.remaining;
    };

    expect(leftAfterFirstFloorChoice(false)).toBe(
      leftAfterFirstFloorChoice(true) + 1,
    );
  });

  it("moves the boss's opinion by their kind, with no number shown", () => {
    const titles = gameContent.demands?.missed?.actions.map((a) => a.title);
    const shifts = new Map<string, Set<number>>();
    const reactions = new Map<string, Set<string>>();
    for (let seed = 1; seed <= 200; seed++) {
      const run = startRun({ seed, content: gameContent });
      const kind =
        readHiddenTruth(run).characters.find((c) => c.id === "boss")?.kind ??
        "";
      let view = run.view();
      for (;;) {
        const { step } = view;
        const free =
          step.kind === "notification"
            ? step.options.find((o) => o.costLabel === "Costs nothing")
            : undefined;
        const next: Choice | undefined =
          step.kind === "notification" && free
            ? {
                type: "notification",
                notificationId: step.id,
                optionId: free.id,
              }
            : view.choices.find((c) => !isMeeting(c));
        if (!next) throw new Error(`Stuck at ${step.kind}.`);
        const before = readHiddenTruth(run).bossOpinion;
        view = run.choose(next);
        if (view.step.kind === "notice" && titles?.includes(view.step.title)) {
          const shift = readHiddenTruth(run).bossOpinion - before;
          shifts.set(kind, (shifts.get(kind) ?? new Set()).add(shift));
          reactions.set(
            kind,
            (reactions.get(kind) ?? new Set()).add(view.step.reaction ?? ""),
          );
          expect(JSON.stringify(view)).not.toMatch(/opinion/i);
          break;
        }
      }
    }

    expect(shifts.get("believer")).toEqual(new Set([-1]));
    expect(shifts.get("incompetent")).toEqual(new Set([0]));
    expect(shifts.get("practitioner")).toEqual(new Set([-2]));
    expect(reactions.get("believer")).not.toEqual(
      reactions.get("practitioner"),
    );
  });

  it("shows none of that meeting's signs to a player who skips it", () => {
    const signs = (
      gameContent.scenes.find((s) => s.id === "meeting")?.signs ?? []
    ).map((s) => s.label);
    const run = startRun({ seed: 2, content: gameContent });
    const seen = JSON.stringify(playMonth(run, false));

    expect(signs.length).toBeGreaterThan(0);
    for (const label of signs) expect(seen).not.toContain(label);
    expect(seen).not.toContain('"kind":"scene"');
  });

  it("follows the stalling bet like any other Demand", () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 120; seed++) {
      const run = startRun({ seed, content: gameContent });
      playMonth(run, true);
      playMonth(run, false);
      let view = run.view();
      const { month } = view;
      while (view.month === month) {
        const { step } = view;
        if (step.kind === "notification") {
          const optionId = missedIds().includes(step.id)
            ? "stall"
            : step.options.find((o) => o.costLabel === "Costs nothing")?.id;
          if (optionId === undefined) throw new Error("Nothing free.");
          view = run.choose({
            type: "notification",
            notificationId: step.id,
            optionId,
          });
        } else {
          const next = view.choices[0];
          if (!next) throw new Error(`Stuck at ${step.kind}.`);
          view = run.choose(next);
        }
      }
      outcomes.add(view.openDemands.length > 0 ? "open" : "closed");
    }

    expect(outcomes).toEqual(new Set(["open", "closed"]));
  });

  it("gives no Demand if no action was left to go with", () => {
    const run = startRun({ seed: 3, content: gameContent });
    const costly = (view: PlayerView): Choice => {
      const { step } = view;
      if (step.kind !== "notification") {
        const next = view.choices[0];
        if (!next) throw new Error(`Stuck at ${step.kind}.`);
        return next;
      }
      const option =
        step.options.find(
          (o) => o.affordable && o.costLabel !== "Costs nothing",
        ) ?? step.options[0];
      return {
        type: "notification",
        notificationId: step.id,
        optionId: option?.id ?? "",
      };
    };
    let view = run.view();
    while (view.month === 1) view = run.choose(costly(view));
    let reachedFloor = false;
    while (view.month === 2) {
      reachedFloor ||= view.step.kind === "actions";
      view = run.choose(costly(view));
    }

    expect(reachedFloor).toBe(false);
    expect(view.openDemands).toEqual([]);
  });

  it("refuses too few written actions for a run", () => {
    const raw = {
      ...structuredClone(gameContent),
      demands: {
        ...structuredClone(gameContent.demands),
        missed: {
          ...structuredClone(gameContent.demands?.missed),
          actions: gameContent.demands?.missed?.actions.slice(0, 1),
        },
      },
    };

    expect(() => parseContent(raw)).toThrow(/every month/);
  });
});
