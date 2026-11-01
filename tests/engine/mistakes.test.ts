import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  ContentError,
  parseContent,
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { fixtureRaw } from "./fixture";

const mistakes = {
  finalWarning: { title: "WARNED", body: "One more." },
  fired: { title: "FIRED", body: "That was one more." },
  firedOutright: { title: "FIRED-OUTRIGHT", body: "That was all it took." },
  results: { title: "ENDED", intro: "It ended." },
  firedIn: "FIRED-IN {month}",
  finished: "LASTED",
};

/** Three months of one Notification: a slip, a catastrophe and something safe. */
function contentWithMistakes() {
  const raw = fixtureRaw();
  raw.balance.monthsPerRun = 3;
  raw.notifications = [
    {
      id: "slip",
      from: "HR",
      subject: "A form",
      body: "Fill it in.",
      options: [
        { id: "safe", label: "Fill it in" },
        { id: "slip", label: "Lose it", mistake: "big" },
        {
          id: "ruin",
          label: "Burn it",
          mistake: "catastrophic",
          stakes: "THE-STAKES",
        },
      ] as (typeof raw.notifications)[number]["options"],
    },
  ];
  return parseContent({ ...raw, mistakes });
}

function answer(run: Run, optionId: string): PlayerView {
  return run.choose({
    type: "notification",
    notificationId: "slip",
    optionId,
  });
}

/** On to the next Notification, or the end, taking the first thing on offer. */
function carryOn(run: Run): PlayerView {
  let view = run.view();
  while (view.step.kind !== "notification" && view.choices.length > 0) {
    view = run.choose(view.choices[0] as Choice);
  }
  return view;
}

describe("big mistakes", () => {
  const content = contentWithMistakes();

  it("sets a Final Warning, which the player is told about and can see", () => {
    const run = startRun({ seed: 1, content });
    expect(run.view().finalWarning).toBe(false);

    const view = answer(run, "slip");

    expect(view.finalWarning).toBe(true);
    expect(view.step).toMatchObject({ kind: "notice", title: "WARNED" });
    expect(carryOn(run).finalWarning).toBe(true);
  });

  it("ends the run at a second one", () => {
    const run = startRun({ seed: 1, content });
    answer(run, "slip");
    carryOn(run);

    const told = answer(run, "slip");
    expect(told.step).toMatchObject({ kind: "notice", title: "FIRED" });

    const ended = run.choose({ type: "continue" });
    expect(ended.month).toBe(2);
    expect(ended.choices).toEqual([]);
    expect(ended.step).toMatchObject({
      kind: "results",
      title: "ENDED",
      ending: { fired: true, text: "FIRED-IN 2" },
      mistakes: [
        { month: 1, choice: "Lose it" },
        { month: 2, choice: "Lose it" },
      ],
    });
  });

  it("still reaches the end of the run with none", () => {
    const run = startRun({ seed: 1, content });
    for (let month = 1; month <= 3; month++) {
      answer(run, "safe");
      carryOn(run);
    }

    const { step, finalWarning, month } = run.view();

    expect(month).toBe(3);
    expect(finalWarning).toBe(false);
    expect(step).toMatchObject({
      kind: "results",
      title: "The end",
      ending: { fired: false, text: "LASTED" },
      mistakes: [],
    });
  });

  it("does not need a second warning to survive one", () => {
    const run = startRun({ seed: 1, content });
    answer(run, "slip");
    carryOn(run);
    answer(run, "safe");
    carryOn(run);
    answer(run, "safe");

    expect(carryOn(run).step).toMatchObject({
      kind: "results",
      ending: { fired: false },
    });
  });
});

describe("a catastrophic choice", () => {
  const content = contentWithMistakes();

  it("signals its stakes before the player chooses", () => {
    const { step } = startRun({ seed: 1, content }).view();

    if (step.kind !== "notification") throw new Error(step.kind);
    expect(step.options.map((o) => o.stakes)).toEqual([
      undefined,
      undefined,
      "THE-STAKES",
    ]);
  });

  it("fires the player outright", () => {
    const run = startRun({ seed: 1, content });

    expect(answer(run, "ruin").step).toMatchObject({
      kind: "notice",
      title: "FIRED-OUTRIGHT",
    });
    expect(run.choose({ type: "continue" }).step).toMatchObject({
      kind: "results",
      ending: { fired: true },
    });
  });
});

describe("what is written", () => {
  const withOption = (extra: object) => {
    const raw = fixtureRaw();
    raw.notifications = [
      {
        id: "slip",
        from: "HR",
        subject: "A form",
        body: "Fill it in.",
        options: [{ id: "o", label: "O", ...extra }],
      },
    ];
    return { ...raw, mistakes };
  };

  it("refuses a catastrophe with no stakes", () => {
    expect(() => parseContent(withOption({ mistake: "catastrophic" }))).toThrow(
      ContentError,
    );
  });

  it("refuses stakes with no catastrophe", () => {
    expect(() => parseContent(withOption({ stakes: "Careful." }))).toThrow(
      ContentError,
    );
  });

  it("refuses a big mistake with no words for it", () => {
    const raw: Partial<ReturnType<typeof withOption>> = withOption({
      mistake: "big",
    });
    delete raw.mistakes;
    expect(() => parseContent(raw)).toThrow(/no words/);
  });

  it("refuses a Move that fires the player with no warning", () => {
    const raw = fixtureRaw();
    raw.moves = [
      {
        id: "m",
        from: "F",
        title: "T",
        body: "B",
        mistake: "catastrophic",
      } as (typeof raw.moves)[number],
    ];
    expect(() => parseContent({ ...raw, mistakes })).toThrow(ContentError);
  });
});

describe("the real content", () => {
  /** Keeps away from anything that burns, and from anything catastrophic. */
  function careful(view: PlayerView): Choice {
    const { step } = view;
    if (step.kind === "scene") {
      const safe =
        step.options.find((o) => /Take a biscuit|Say nothing/i.test(o.label)) ??
        step.options.find(
          (o) => !/blame|cut|report|rumour|Say that|Mention/i.test(o.label),
        ) ??
        step.options.at(-1);
      if (safe) {
        return { type: "scene", sceneId: step.id, optionId: safe.id };
      }
    }
    if (step.kind === "notification") {
      const free = step.options.find((o) => o.costLabel === "Costs nothing");
      if (free) {
        return {
          type: "notification",
          notificationId: step.id,
          optionId: free.id,
        };
      }
    }
    const choice = view.choices[0];
    if (!choice) throw new Error("No choice.");
    return choice;
  }

  it("makes blaming someone with a dangerous Hidden Fact a big mistake", () => {
    const seed = [...Array(60).keys()].find((s) => {
      const truth = readHiddenTruth(
        startRun({ seed: s, content: gameContent }),
      );
      const projects = truth.characters.find((c) => c.id === "projects");
      const fact = gameContent.hiddenTruth.facts.find(
        (f) => f.id === projects?.fact?.id,
      );
      return fact?.nature === "dangerous";
    });
    if (seed === undefined) throw new Error("No such deal.");
    const run = startRun({ seed, content: gameContent });
    let view = run.view();
    while (!(
      view.step.kind === "scene" && view.step.id === "lessons-learned"
    )) {
      if (view.month > 2) throw new Error("Never reached the review.");
      const meeting = view.choices.find(
        (c) => c.type === "action" && c.actionId === "meeting-lessons",
      );
      view = run.choose(meeting ?? careful(view));
    }

    view = run.choose({
      type: "scene",
      sceneId: "lessons-learned",
      optionId: "blame-callum",
    });

    expect(view.finalWarning).toBe(true);
  });

  it("offers one catastrophe, which says what is at stake", () => {
    const options = gameContent.scenes.flatMap((s) =>
      s.options.filter((o) => o.stakes !== undefined),
    );
    expect(options.length).toBeGreaterThan(0);
  });

  it.each([1, 2, 4, 8, 13, 16])(
    "reaches the end of the run on seed %i, played with care",
    (seed) => {
      const run = startRun({ seed, content: gameContent });
      let view = run.view();
      while (view.choices.length > 0) view = run.choose(careful(view));

      expect(view.step).toMatchObject({
        kind: "results",
        ending: { fired: false },
      });
      expect(view.month).toBe(gameContent.balance.monthsPerRun);
    },
  );

  it("never says what kind anyone is through a mistake", () => {
    const { mistakes: words } = gameContent;
    const labels = Object.values(gameContent.hiddenTruth.kinds).map((k) =>
      k.label.toLowerCase(),
    );
    const written = JSON.stringify(words).toLowerCase();
    for (const label of labels) expect(written).not.toContain(label);
  });
});
