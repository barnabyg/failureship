import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  IllegalChoiceError,
  parseContent,
  startRun,
  type Choice,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { action, sceneFixtureRaw } from "./fixture";

function notebookFixtureRaw() {
  const raw = sceneFixtureRaw();
  raw.behaviours = [
    {
      id: "late",
      text: "{who} is late.",
      clue: "{who} CLUE-LATE",
      likelihood: { believer: 1, incompetent: 8, practitioner: 1 },
    },
    {
      id: "kind",
      text: "{who} is kind.",
      clue: "{who} CLUE-KIND",
      likelihood: { believer: 8, incompetent: 1, practitioner: 1 },
    },
    {
      id: "quiet",
      text: "{who} is quiet.",
      likelihood: { believer: 2, incompetent: 3, practitioner: 2 },
    },
  ] as typeof raw.behaviours;
  const scene = raw.scenes[0];
  if (scene) {
    scene.signs[0] = {
      label: "Who interrupts whom",
      text: "{holder} talks over {ignored}.",
      clue: "{holder} CLUE-INTERRUPTS {ignored}",
    } as (typeof scene.signs)[number];
  }
  raw.notebook.events = [
    {
      id: "kettle",
      when: { flag: "had-tea" },
      source: "The kettle",
      text: "CLUE-KETTLE",
      verdict: "idle",
    },
  ];
  const ask = {
    ...action("copier"),
    result: undefined,
    findOut: "ask",
  };
  return {
    ...raw,
    actions: raw.actions.map((a) => {
      if (a.id === "copier") return ask;
      return a.id === "kettle" ? { ...a, sets: ["had-tea"] } : a;
    }),
  };
}

const content = (): Content => parseContent(notebookFixtureRaw());

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

describe("the Notebook's clues", () => {
  it("starts empty", () => {
    expect(
      startRun({ seed: 1, content: content() }).view().notebook.clues,
    ).toEqual([]);
  });

  it("keeps the clues from a Scene, by month and by whom", () => {
    const run = startRun({ seed: 1, content: content() });

    const view = run.choose({ type: "action", actionId: "meeting" });

    const { clues } = view.notebook;
    expect(clues.length).toBeGreaterThan(0);
    for (const clue of clues) {
      expect(clue.month).toBe(1);
      expect(clue.source).not.toBe("");
      expect(clue.text).not.toMatch(/\{\w+\}/);
    }
    expect(clues.some((c) => c.text.includes("CLUE-INTERRUPTS"))).toBe(true);
  });

  it("leaves out a sign that names no clue", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const run = startRun({ seed, content: content() });
      const view = run.choose({ type: "action", actionId: "meeting" });
      if (view.step.kind !== "scene") throw new Error(view.step.kind);
      const shownClues = view.step.behaviours.filter(
        (b) => !b.text.includes("quiet"),
      ).length;

      expect(view.notebook.clues).toHaveLength(shownClues + 1);
    }
  });

  it("keeps a claim, under the name of its source", () => {
    const run = startRun({ seed: 1, content: content() });
    run.choose({ type: "action", actionId: "copier" });

    const view = run.choose({
      type: "find-out",
      sourceId: "ben",
      subjectId: "cal",
    });

    if (view.step.kind !== "claim") throw new Error(view.step.kind);
    expect(view.notebook.clues).toEqual([
      { month: 1, source: "Ben Bird", text: view.step.text },
    ]);
  });

  it("keeps a clue from an event once, set in data", () => {
    const run = startRun({ seed: 1, content: content() });

    run.choose({ type: "action", actionId: "kettle" });
    run.choose({ type: "continue" });
    const view = run.choose({ type: "action", actionId: "kettle" });

    expect(view.notebook.clues).toEqual([
      { month: 1, source: "The kettle", text: "CLUE-KETTLE" },
    ]);
  });

  it("carries clues from one month to the next", () => {
    const run = startRun({ seed: 1, content: content() });
    run.choose({ type: "action", actionId: "kettle" });

    let view = run.view();
    while (view.month === 1) {
      const choice = view.choices.at(-1);
      if (!choice) throw new Error("Stuck.");
      view = run.choose(choice);
    }

    expect(view.notebook.clues.map((c) => c.text)).toContain("CLUE-KETTLE");
  });

  it("never says whether a clue is true, before the run ends", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const run = startRun({ seed, content: content() });
      run.choose({ type: "action", actionId: "copier" });
      const views = [
        run.choose({ type: "find-out", sourceId: "ben", subjectId: "cal" }),
        run.choose({ type: "continue" }),
        run.choose({ type: "action", actionId: "meeting" }),
      ];
      for (const view of views) {
        for (const clue of view.notebook.clues) {
          expect(Object.keys(clue).sort()).toEqual(["month", "source", "text"]);
        }
        expect(JSON.stringify(view.notebook)).not.toMatch(
          /verdict|status|false|irrelevant|VERDICT/,
        );
      }
    }
  });
});

describe("marks", () => {
  it("puts a suspicion against a Character, and can change or clear it", () => {
    const run = startRun({ seed: 1, content: content() });
    const markOf = (view: PlayerView) =>
      view.notebook.marks.find((m) => m.id === "ben")?.mark;

    expect(markOf(run.view())).toBeNull();
    expect(markOf(run.mark("ben", "practitioner"))).toBe("practitioner");
    expect(markOf(run.mark("ben", "believer"))).toBe("believer");
    expect(markOf(run.mark("ben", null))).toBeNull();
  });

  it("costs no actions, and can be done at any step", () => {
    const run = startRun({ seed: 1, content: content() });
    run.choose({ type: "action", actionId: "meeting" });

    const view = run.mark("ana", "incompetent");

    expect(view.actions.remaining).toBe(2);
    expect(view.step.kind).toBe("scene");
  });

  it("refuses someone who is not a Character, or a kind that is not one", () => {
    const run = startRun({ seed: 1, content: content() });

    expect(() => run.mark("nobody", "believer")).toThrow(IllegalChoiceError);
    expect(() => run.mark("ben", "wizard" as never)).toThrow(
      IllegalChoiceError,
    );
  });

  it("does not change the outcome of the run", () => {
    const world = content();
    const script = (run: Run, marking: boolean): PlayerView[] => {
      const views: PlayerView[] = [];
      let view = run.view();
      for (let turn = 0; view.choices.length > 0; turn++) {
        if (marking) {
          run.mark("ben", turn % 2 === 0 ? "believer" : "practitioner");
          run.mark("ana", "incompetent");
        }
        const choice: Choice | undefined = view.choices[0];
        if (!choice) break;
        view = run.choose(choice);
        views.push(view);
      }
      return views;
    };
    const withoutMarks = (views: PlayerView[]) =>
      views.map((view) => {
        const stripped: Partial<PlayerView> = { ...view };
        delete stripped.notebook;
        if (view.step.kind !== "results") return stripped;
        return { ...stripped, step: { ...view.step, marks: [] } };
      });

    for (const seed of [1, 2, 3, 4, 5]) {
      const a = startRun({ seed, content: world });
      const b = startRun({ seed, content: world });

      expect(withoutMarks(script(a, true))).toEqual(
        withoutMarks(script(b, false)),
      );
      expect(readHiddenTruth(a)).toEqual(readHiddenTruth(b));
    }
  });

  it("can no longer be changed once the run has ended", () => {
    const run = startRun({ seed: 1, content: content() });
    playOut(run);

    expect(() => run.mark("ben", "believer")).toThrow(IllegalChoiceError);
  });
});

describe("the results screen", () => {
  it("shows each mark against the truth", () => {
    const world = content();
    const run = startRun({ seed: 1, content: world });
    const dealt = readHiddenTruth(run).characters;
    const benKind = dealt.find((c) => c.id === "ben")?.kind;
    if (!benKind) throw new Error("No Ben.");
    run.mark("ben", benKind);
    run.mark("ana", benKind === "believer" ? "incompetent" : "believer");

    const { marks } = resultsOf(playOut(run));

    const row = (name: string) => marks.find((m) => m.name === name);
    expect(row("Ben Bird")).toMatchObject({
      mark: world.hiddenTruth.kinds[benKind].label,
      truth: world.hiddenTruth.kinds[benKind].label,
      correct: true,
    });
    expect(row("Ana Abel")?.correct).toBe(
      dealt.find((c) => c.id === "ana")?.kind ===
        (benKind === "believer" ? "incompetent" : "believer"),
    );
    expect(row("Cal Cope")).toMatchObject({ mark: null, correct: false });
  });

  it("shows which clues were false or did not matter", () => {
    const run = startRun({ seed: 1, content: content() });
    run.choose({ type: "action", actionId: "kettle" });

    const { clues } = resultsOf(playOut(run));

    const kettle = clues.find((c) => c.text === "CLUE-KETTLE");
    expect(kettle?.verdict).toBe("VERDICT-IRRELEVANT");
  });

  it("calls a claim false unless it was true", () => {
    const world = content();
    const verdicts = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const run = startRun({ seed, content: world });
      run.choose({ type: "action", actionId: "copier" });
      run.choose({ type: "find-out", sourceId: "ben", subjectId: "cal" });
      const { clues, claims } = resultsOf(playOut(run));
      const clue = clues.find((c) => c.text === claims[0]?.text);
      if (!clue) throw new Error("The claim left no clue.");
      verdicts.add(`${claims[0]?.verdict ?? ""}>${clue.verdict}`);
    }

    expect(verdicts).toContain("VERDICT-MISTAKEN>VERDICT-FALSE");
    expect(verdicts).toContain("VERDICT-OLD>VERDICT-FALSE");
    expect(verdicts).toContain("VERDICT-TRUE>VERDICT-HELD");
    expect(verdicts).not.toContain("VERDICT-TRUE>VERDICT-FALSE");
  });

  it("scores a behaviour by whether it pointed at the true kind", () => {
    const world = content();
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const run = startRun({ seed, content: world });
      run.choose({ type: "action", actionId: "meeting" });
      const kinds = readHiddenTruth(run).characters;
      const { clues } = resultsOf(playOut(run));
      for (const clue of clues.filter((c) => c.text.includes("CLUE-LATE"))) {
        const who = clue.text.split(" CLUE-LATE")[0];
        const id = world.characters.find((c) => c.name === who)?.id;
        const kind = kinds.find((c) => c.id === id)?.kind;
        expect(clue.verdict).toBe(
          kind === "incompetent" ? "VERDICT-HELD" : "VERDICT-FALSE",
        );
        seen.add(clue.verdict);
      }
    }

    expect(seen.size).toBe(2);
  });
});

describe("the Notebook in content", () => {
  it("rejects an event that would reveal the hidden truth by appearing", () => {
    const raw = notebookFixtureRaw();
    const event = raw.notebook.events[0];
    if (event) event.when = { holderIs: "ana" };

    expect(() => parseContent(raw)).toThrow(/hidden truth/);
  });

  it("rejects a behaviour's clue that does not say who", () => {
    const raw = notebookFixtureRaw();
    const late = raw.behaviours[0] as { clue?: string } | undefined;
    if (late) late.clue = "Somebody was late.";

    expect(() => parseContent(raw)).toThrow(/\{who\}/);
  });
});

describe("the game's Notebook", () => {
  /** A careful run: every source and every meeting, month after month. */
  function carefulRun(seed: number) {
    const run = startRun({ seed, content: gameContent });
    let view = run.view();
    for (let turn = 0; view.choices.length > 0 && turn < 500; turn++) {
      const choices = view.choices;
      const pick =
        choices.find(
          (c) => c.type === "action" && c.actionId.includes("ask"),
        ) ??
        choices.find(
          (c) => c.type === "action" && c.actionId.includes("meet"),
        ) ??
        choices[turn % choices.length];
      if (!pick) break;
      view = run.choose(pick);
    }
    return resultsOf(view);
  }

  it("includes clues that are false or do not matter in most runs", () => {
    const { held, wrong, idle } = gameContent.ui.clueVerdicts;
    const runs = [1, 2, 3, 4, 5, 6, 7, 8].map(carefulRun);
    for (const { clues } of runs) {
      const verdicts = clues.map((c) => c.verdict);
      expect(verdicts).toContain(held);
      expect(verdicts).toContain(wrong);
    }
    expect(
      runs.filter((r) => r.clues.some((c) => c.verdict === idle)).length,
    ).toBeGreaterThan(0);
  });

  it("keeps what mattered, not everything", () => {
    const withClue = gameContent.behaviours.filter((b) => b.clue !== undefined);

    expect(withClue.length).toBeGreaterThan(0);
    expect(withClue.length).toBeLessThan(gameContent.behaviours.length);
    expect(gameContent.notebook.events.length).toBeGreaterThan(0);
  });
});
