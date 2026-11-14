import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  startRun,
  type Choice,
  type Kind,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { emptyMonthRaw, floorOwn } from "./fixture";
import { isLate, lateInMonthTwo } from "./late-input";

/** A run on a seed whose input is late, standing at that Notification. */
function atLateInput(seed: number): Run {
  const run = startRun({ seed, content: gameContent });
  let view = run.view();
  while (!(
    view.step.kind === "notification" && view.step.id === "report-input-late"
  )) {
    const next = freeChoice(view);
    if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(next);
  }
  return run;
}

/** Answers a Notification for nothing, and otherwise carries on as it can. */
function freeChoice(view: PlayerView): Choice | undefined {
  if (view.step.kind !== "notification") return view.choices.at(-1);
  const { id, options } = view.step;
  const free = options.find((o) => o.costLabel === "Costs nothing");
  return (
    free && { type: "notification", notificationId: id, optionId: free.id }
  );
}

/** The first thirty seeds whose input is late, found once. */
let lateFound: number[] | undefined;
function lateSeeds(): number[] {
  if (lateFound) return lateFound;
  lateFound = [];
  for (let seed = 1; lateFound.length < 30; seed++) {
    if (lateInMonthTwo(seed)) lateFound.push(seed);
  }
  return lateFound;
}

const answer = (optionId: string): Choice => ({
  type: "notification",
  notificationId: "report-input-late",
  optionId,
});

describe("late input for the report", () => {
  // How often, and from which kinds, is in tests/balance/engine-late-input.
  it("never comes in the first month", () => {
    expect(gameContent.project.input?.months).not.toContain(1);
  });

  it("is the same for the same seed and choices", () => {
    for (const seed of lateSeeds().slice(0, 5)) {
      expect(lateInMonthTwo(seed)).toBe(true);
    }
    for (let seed = 1; seed <= 5; seed++) {
      expect(lateInMonthTwo(seed)).toBe(lateInMonthTwo(seed));
    }
  });

  it("is not moved by what the player did earlier in the run", () => {
    const lateInMonthTwo = (seed: number, optionId: "pub" | "decline") => {
      const run = startRun({ seed, content: gameContent });
      run.choose({
        type: "notification",
        notificationId: "pub-invite",
        optionId,
      });
      return isLate(run, 2);
    };

    for (let seed = 1; seed <= 10; seed++) {
      expect(lateInMonthTwo(seed, "pub")).toBe(lateInMonthTwo(seed, "decline"));
    }
  });

  it("reads the same whichever kind is behind it", () => {
    const shown = new Set(
      lateSeeds()
        .slice(0, 30)
        .map((seed) => JSON.stringify(atLateInput(seed).view().step)),
    );

    expect(shown.size).toBe(1);
    expect([...shown][0]).not.toMatch(/Believer|Incompetent|Practitioner/i);
  });
});

describe("answering late input", () => {
  const seed = (): number => {
    const found = lateSeeds()[0];
    if (found === undefined) throw new Error("No seed has late input.");
    return found;
  };

  it("chasing costs an action, and then the report can be filed", () => {
    const run = atLateInput(seed());
    const before = run.view().actions.remaining;

    const view = run.choose(answer("chase"));

    expect(view.actions.remaining).toBe(before - 1);
    expect(view.step).toMatchObject({
      kind: "notification",
      id: "monthly-report",
    });
  });

  it("filing without it settles the report, at the report's cost", () => {
    const run = atLateInput(seed());
    const before = run.view().actions.remaining;

    const view = run.choose(answer("file-without"));

    expect(view.actions.remaining).toBe(before - 1);
    expect(view.step.kind).not.toBe("notification");
    expect(view.project.reported).toBe("Amber");
  });

  it("waiting is free, and sometimes misses the deadline", () => {
    const outcomes = lateSeeds()
      .slice(0, 20)
      .map((late) => {
        const run = atLateInput(late);
        const before = run.view().actions.remaining;
        const view = run.choose(answer("wait"));
        if (view.step.kind !== "notification") return "missed";
        // A missed deadline goes on to whatever it costs, but waiting is free.
        expect(view.actions.remaining).toBe(before);
        return "in time";
      });

    expect(outcomes).toContain("in time");
    expect(outcomes).toContain("missed");
  });

  it("gives each answer a different outcome", () => {
    const after = (optionId: string, late: number) => {
      const run = atLateInput(late);
      const { result } = run.choose(answer(optionId));
      return result?.kind === "answer" && result.then.kind === "notice"
        ? result.then.body
        : result?.kind;
    };
    const late = seed();

    expect(
      new Set([after("chase", late), after("file-without", late)]).size,
    ).toBe(2);
  });

  it("can reach the Notebook as a clue", () => {
    const run = atLateInput(seed());

    const { notebook } = run.choose(answer("chase"));

    expect(notebook.clues.map((c) => c.source)).toContain("Your inbox");
  });
});

describe("late input in content", () => {
  const withChance = (chance: Record<Kind, number>) => {
    const raw = emptyMonthRaw();
    raw.project.input = { character: "ben", chance, sets: "input-late" };
    return raw;
  };

  it.each([
    [
      "only one kind",
      { believer: 0, incompetent: 0, practitioner: 0.5 },
      /only one kind/,
    ],
    [
      "no evidence",
      { believer: 0.3, incompetent: 0.3, practitioner: 0.3 },
      /no evidence/,
    ],
    [
      "certainty",
      { believer: 0.1, incompetent: 1, practitioner: 0.5 },
      /certain/,
    ],
  ])("rejects odds that give %s", (_name, chance, message) => {
    expect(() => parseContent(withChance(chance))).toThrow(message);
  });

  it("rejects an input from someone who does not exist", () => {
    const raw = withChance({
      believer: 0.1,
      incompetent: 0.5,
      practitioner: 0.3,
    });
    if (raw.project.input) raw.project.input.character = "nobody";

    expect(() => parseContent(raw)).toThrow(/nobody/);
  });

  it("rejects a Notification gated on the hidden truth", () => {
    const raw = {
      ...emptyMonthRaw(),
      notifications: [
        {
          id: "gated",
          from: "Boss",
          subject: "S",
          body: "B",
          when: { bossIs: "believer" },
          options: [
            { id: "ok", label: "OK", result: { title: "T", body: "B" } },
          ],
        },
        ...floorOwn(),
      ],
    };

    expect(() => parseContent(raw)).toThrow(/gated on the hidden truth/);
  });
});
