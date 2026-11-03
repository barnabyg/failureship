import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { plainChoice } from "../../src/ui/later-month";
import {
  parseContent,
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { closingFixtureRaw, fixtureRaw, floorOwn } from "./fixture";

function standing() {
  return {
    label: "ON-PAPER",
    title: "How you would do on paper.",
    start: 50,
    reported: { good: 0, fair: 0, bad: -30 },
    finalWarning: 10,
    bands: [
      { from: 0, label: "RED", onPaper: "PAPER-RED" },
      { from: 34, label: "AMBER", onPaper: "PAPER-AMBER" },
      { from: 67, label: "GREEN", onPaper: "PAPER-GREEN" },
    ],
    deeds: [{ flag: "filed", by: 20 }],
    decides: "DECIDED-BY {who}",
  };
}

/** Three months of a report, which can be filed, coloured or lost. */
function raw() {
  const base = fixtureRaw();
  return {
    ...base,
    balance: { ...base.balance, monthsPerRun: 3 },
    notifications: [
      {
        id: "report",
        from: "Your boss",
        subject: "The report",
        body: "File it, or not.",
        options: [
          { id: "nothing", label: "Do nothing" },
          { id: "file", label: "File it", sets: ["filed"] },
          {
            id: "redden",
            label: "Say it is bad",
            project: { reported: "bad" },
          },
          { id: "lose", label: "Lose it", mistake: "big" },
        ],
      },
      ...floorOwn(),
    ] as ReturnType<typeof fixtureRaw>["notifications"],
    standing: standing(),
    mistakes,
  };
}

const mistakes = {
  finalWarning: { title: "WARNED", body: "One more." },
  fired: { title: "FIRED", body: "That was one more." },
  firedOutright: { title: "FIRED-OUTRIGHT", body: "That was all it took." },
  results: { title: "ENDED", intro: "It ended." },
  firedIn: "FIRED-IN {month}",
  finished: "LASTED",
};

const answer = (optionId: string): Choice => ({
  type: "notification",
  notificationId: "report",
  optionId,
});

/** Plays to the end, answering each month's report the same way. */
function playOut(run: Run, optionId: string): PlayerView[] {
  const views = [run.view()];
  for (let view = run.view(); view.choices.length > 0;) {
    view = run.choose(
      view.step.kind === "notification"
        ? answer(optionId)
        : (view.choices[0] as Choice),
    );
    views.push(view);
  }
  return views;
}

/** On to the next month's report, taking the first thing on offer. */
function nextReport(run: Run): PlayerView {
  let view = run.choose(run.view().choices[0] as Choice);
  while (view.step.kind !== "notification") {
    view = run.choose(view.choices[0] as Choice);
  }
  return view;
}

const at = (view: PlayerView | undefined) => view?.standing?.at;

describe("Official standing", () => {
  it("is in view at every step, and moves with what the player's choices put on the record", () => {
    const content = parseContent(raw());
    const still = playOut(startRun({ seed: 1, content }), "nothing");
    const filed = playOut(startRun({ seed: 1, content }), "file");

    for (const view of [...still, ...filed]) {
      expect(view.standing?.label).toBe("ON-PAPER");
    }
    expect(still.map(at)).toEqual(still.map(() => 0.5));
    expect(still[0]?.standing?.band).toBe("AMBER");
    // Filed in each of three months: 50, then 70, 90 and the top.
    expect(at(filed.at(-1))).toBe(1);
    expect(filed.at(-1)?.standing?.band).toBe("GREEN");
    expect(new Set(filed.map(at))).toEqual(new Set([0.5, 0.7, 0.9, 1]));
  });

  it("goes by the Project's reported status, whatever its real one", () => {
    const content = parseContent(raw());
    const run = startRun({ seed: 1, content });

    const view = run.choose(answer("redden"));

    expect(view.project.real).toBe("STATUS-FAIR");
    expect(at(view)).toBe(0.2);
    expect(view.standing?.band).toBe("RED");
  });

  it("turns red on a Final Warning, and stays there whatever goes on the record", () => {
    const content = parseContent(raw());
    const run = startRun({ seed: 1, content });
    run.choose(answer("file"));
    expect(at(nextReport(run))).toBe(0.7);

    const warned = run.choose(answer("lose"));

    expect(warned.finalWarning).toBe(true);
    expect(at(warned)).toBe(0.1);
    expect(warned.standing?.band).toBe("RED");
    nextReport(run);
    expect(at(run.choose(answer("file")))).toBe(0.1);
  });

  it("is the same on deals with different Power Maps when the player makes the same choices", () => {
    const content = parseContent(raw());
    const maps = new Set<string>();
    const runs = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const run = startRun({ seed, content });
      maps.add(JSON.stringify(readHiddenTruth(run).powerMap));
      runs.add(
        JSON.stringify(playOut(run, "file").map((v) => [v.month, v.standing])),
      );
    }

    expect(maps.size).toBeGreaterThan(5);
    expect(runs.size).toBe(1);
  });
});

describe("the rules of Official standing", () => {
  it("never read the truth of the run", () => {
    const source = readFileSync(
      path.join(import.meta.dirname, "../../src/engine/standing.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\.truth\b|powerMap|beliefs|risks|marks/);
  });
});

describe("the real Official standing", () => {
  it("is in view at every step of a real run, from amber", () => {
    const run = startRun({ seed: 1, content: gameContent });
    const views = [run.view()];
    while (views.at(-1)?.choices.length) {
      views.push(run.choose(plainChoice(views.at(-1) as PlayerView)));
    }

    expect(views[0]?.standing?.band).toBe("Amber");
    for (const view of views) expect(view.standing).not.toBeNull();
    const end = views.at(-1)?.step;
    if (end?.kind !== "results") throw new Error("No results.");
    expect(end.standing?.decides).toMatch(/in the gift of \S/);
  });
});

describe("Official standing on the results screen", () => {
  it("sits beside who really held influence over the boss's seat", () => {
    const content = parseContent(raw());
    const names: Record<string, string> = {
      ana: "Ana Abel",
      ben: "Ben Bird",
      cal: "Cal Cope",
    };
    const deciders = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const run = startRun({ seed, content });
      const { powerMap } = readHiddenTruth(run);
      // The boss's own boss on the Power Map, or the boss if nobody is over them.
      const decider =
        powerMap.influence.find((i) => i.over === "ana")?.who ?? "ana";
      const views = playOut(run, "nothing");
      const end = views.at(-1)?.step;
      if (end?.kind !== "results") throw new Error("No results.");

      expect(end.standing).toMatchObject({
        label: "ON-PAPER",
        at: 0.5,
        band: "AMBER",
        onPaper: "PAPER-AMBER",
        decides: `DECIDED-BY ${names[decider] ?? ""}`,
      });
      deciders.add(decider);
    }
    expect(deciders.size).toBeGreaterThan(1);
  });
});

describe("Official standing's data", () => {
  const withDeeds = (deeds: { flag: string; by: number }[]) => ({
    ...closingFixtureRaw(),
    standing: { ...standing(), deeds },
  });

  it("reads flags the player's own choices set in plain view", () => {
    expect(() =>
      parseContent(withDeeds([{ flag: "quiet", by: 5 }])),
    ).not.toThrow();
  });

  it("is refused with a flag that says which way something hidden went", () => {
    expect(() =>
      parseContent(withDeeds([{ flag: "backed-right", by: 5 }])),
    ).toThrow(
      /Official standing reads "backed-right", which no choice of the player's sets in plain view/,
    );
  });

  it("is refused with a flag only something else sets, or nothing does", () => {
    expect(() =>
      parseContent(withDeeds([{ flag: "word-stolen", by: 5 }])),
    ).toThrow(/"word-stolen"/);
    expect(() => parseContent(withDeeds([{ flag: "nowhere", by: 5 }]))).toThrow(
      /"nowhere"/,
    );
  });

  it("is refused with a flag only a chased Demand's answer sets, since the boss's kind decides whether it is chased", () => {
    const notice = { title: "Done", body: "Done." };
    const chasable = {
      ...raw(),
      demands: {
        odds: {
          believer: { forgets: 0.2, chases: 0.4 },
          incompetent: { forgets: 0.6, chases: 0.1 },
          practitioner: { forgets: 0.3, chases: 0.3 },
        },
        chasedPenalty: { believer: 0, incompetent: 0, practitioner: 0 },
        sets: { forgotten: "forgot", chased: "chased" },
        items: [
          {
            id: "tool",
            floor: "fixture-job",
            months: [1],
            from: "Boss",
            subject: "A tool",
            body: "Roll it out.",
            options: [
              ...["deliver", "push-back", "hand-off", "fake"].map((id) => ({
                id,
                label: id,
                result: notice,
              })),
              { id: "stall", label: "Stall", result: notice, stalls: true },
            ],
            forgotten: notice,
            chased: {
              from: "Boss",
              subject: "Well?",
              body: "Well?",
              options: [
                { id: "late", label: "Late", result: notice, sets: ["late"] },
              ],
            },
          },
        ],
      },
    };
    chasable.standing.deeds = [{ flag: "late", by: 5 }];

    expect(() => parseContent(chasable)).toThrow(
      /Official standing reads "late"/,
    );
  });

  it("is refused unless it says what every reported status adds", () => {
    const missing = raw();
    missing.standing.reported = {
      good: 0,
      fair: 0,
    } as typeof missing.standing.reported;
    expect(() => parseContent(missing)).toThrow(/reported status "bad"/);

    const unknown = raw();
    unknown.standing.reported = {
      ...unknown.standing.reported,
      purple: 1,
    } as typeof unknown.standing.reported;
    expect(() => parseContent(unknown)).toThrow(/unknown status "purple"/);
  });

  it("is refused with bands out of order, or a Final Warning that is not red", () => {
    const late = raw();
    late.standing.bands = late.standing.bands.slice(1);
    expect(() => parseContent(late)).toThrow(/bands must start at 0/);

    const muddled = raw();
    muddled.standing.bands = [...muddled.standing.bands].reverse();
    expect(() => parseContent(muddled)).toThrow(/bands must start at 0/);

    const amber = raw();
    amber.standing.finalWarning = 50;
    expect(() => parseContent(amber)).toThrow(/Final Warning .* first band/);
  });
});
