import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  KINDS,
  parseContent,
  startRun,
  type Choice,
  type Kind,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { emptyMonthRaw } from "./fixture";

const SEEDS = Array.from({ length: 600 }, (_, i) => i + 1);
const INPUT = gameContent.project.input;

/** Whether this seed's report input is late in this month, whatever you did. */
function isLate(run: Run, month: number): boolean {
  let view = run.view();
  while (view.month < month) {
    const next = view.choices.at(-1);
    if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(next);
  }
  const notified = (v: PlayerView) =>
    v.step.kind === "notification" && v.step.id === "report-input-late";
  while (view.month === month && view.step.kind === "notification") {
    if (notified(view)) return true;
    const free = view.step.options.find((o) => o.costLabel === "Costs nothing");
    if (free === undefined || view.step.id === "monthly-report") return false;
    run.choose({
      type: "notification",
      notificationId: view.step.id,
      optionId: free.id,
    });
    view = run.choose({ type: "continue" });
  }
  return false;
}

/** Whether the report's input is late in month 2, read as the player would. */
function lateInMonthTwo(seed: number) {
  return isLate(startRun({ seed, content: gameContent }), 2);
}

function colleagueKind(seed: number): Kind {
  const run = startRun({ seed, content: gameContent });
  const kind = readHiddenTruth(run).characters.find(
    (c) => c.id === INPUT?.character,
  )?.kind;
  if (kind === undefined) throw new Error("No colleague was dealt.");
  return kind;
}

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

const lateSeeds = () => SEEDS.filter(lateInMonthTwo);

const answer = (optionId: string): Choice => ({
  type: "notification",
  notificationId: "report-input-late",
  optionId,
});

describe("late input for the report", () => {
  it("comes in some months and not others", () => {
    const late = lateSeeds();

    expect(late.length).toBeGreaterThan(SEEDS.length / 10);
    expect(late.length).toBeLessThan(SEEDS.length * 0.9);
    expect(gameContent.project.input?.months).not.toContain(1);
  });

  it("is more likely from some kinds, without settling which kind someone is", () => {
    const rates = Object.fromEntries(
      KINDS.map((kind) => {
        const dealt = SEEDS.filter((seed) => colleagueKind(seed) === kind);
        const late = dealt.filter(lateInMonthTwo);
        return [kind, late.length / dealt.length];
      }),
    ) as Record<Kind, number>;

    expect(rates.incompetent).toBeGreaterThan(rates.believer);
    expect(rates.practitioner).toBeGreaterThan(rates.believer);
    for (const kind of KINDS) {
      expect(rates[kind], kind).toBeGreaterThan(0);
      expect(rates[kind], kind).toBeLessThan(1);
    }
  });

  it("is the same for the same seed and choices", () => {
    for (const seed of SEEDS.slice(0, 50)) {
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

    for (const seed of SEEDS.slice(0, 40)) {
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

    run.choose(answer("chase"));
    const view = run.choose({ type: "continue" });

    expect(view.actions.remaining).toBe(before - 1);
    expect(view.step).toMatchObject({
      kind: "notification",
      id: "monthly-report",
    });
  });

  it("filing without it settles the report, at the report's cost", () => {
    const run = atLateInput(seed());
    const before = run.view().actions.remaining;

    run.choose(answer("file-without"));
    const view = run.choose({ type: "continue" });

    expect(view.actions.remaining).toBe(before - 1);
    expect(view.step.kind).not.toBe("notification");
    expect(view.project.reported).toBe("Amber");
  });

  it("waiting is free, and sometimes misses the deadline", () => {
    const outcomes = lateSeeds().map((late) => {
      const run = atLateInput(late);
      const before = run.view().actions.remaining;
      const waited = run.choose(answer("wait"));
      expect(waited.actions.remaining).toBe(before);
      const view = run.choose({ type: "continue" });
      return view.step.kind === "notification" ? "in time" : "missed";
    });

    expect(outcomes).toContain("in time");
    expect(outcomes).toContain("missed");
  });

  it("gives each answer a different outcome", () => {
    const after = (optionId: string, late: number) => {
      const run = atLateInput(late);
      const { step } = run.choose(answer(optionId));
      return step.kind === "notice" ? step.body : step.kind;
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
      ],
    };

    expect(() => parseContent(raw)).toThrow(/gated on the hidden truth/);
  });
});
