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
import { lowerOnMap, raiseOnMap, type PowerMap } from "../../src/engine/deal";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { fixtureRaw } from "./fixture";

const story = { reported: "EVENT-REPORTED", happened: "EVENT-HAPPENED" };
const certain = { believer: 1, incompetent: 1, practitioner: 1 };

function outside(extra: object = {}) {
  return {
    id: "bid",
    from: "The Board",
    title: "THE-EVENT",
    body: "Something has happened.",
    story,
    schedule: { months: [2], chance: 1 },
    ...extra,
  };
}

function raw(events: object[], extra: object = {}) {
  const base = fixtureRaw();
  base.balance.monthsPerRun = 4;
  base.notifications = [];
  base.moves = [{ id: "m", from: "F", title: "A-MOVE", body: "B" }];
  return { ...base, events, ...extra };
}

function play(run: Run): PlayerView[] {
  let view = run.view();
  const views = [view];
  while (view.choices.length > 0) {
    view = run.choose(view.choices[0] as Choice);
    views.push(view);
  }
  return views;
}

const landed = (views: PlayerView[]) =>
  views.filter((v) => v.step.kind === "event");

function resultsOf(views: PlayerView[]) {
  const { step } = views.at(-1) as PlayerView;
  if (step.kind !== "results") throw new Error(step.kind);
  return step;
}

describe("a month with a Company Event in it", () => {
  const content = parseContent(raw([outside()]));

  it("runs in the defined order, after the actions and before it closes", () => {
    const views = play(startRun({ seed: 1, content }));
    const inMonth = views.filter((v) => v.month === 2).map((v) => v.step.kind);

    const event = inMonth.indexOf("event");
    expect(inMonth.lastIndexOf("actions")).toBeLessThan(event);
    expect(event).toBeLessThan(inMonth.indexOf("move"));
    expect(inMonth.indexOf("move")).toBeLessThan(inMonth.indexOf("story"));
  });

  it("offers nothing to choose", () => {
    const [view] = landed(play(startRun({ seed: 1, content })));

    expect(view?.choices).toEqual([{ type: "continue" }]);
    expect(view?.step).toMatchObject({ from: "The Board", title: "THE-EVENT" });
  });

  it("is covered by the official story, that month and no other", () => {
    const stories = play(startRun({ seed: 1, content })).flatMap((v) =>
      v.step.kind === "story" ? [{ month: v.month, step: v.step }] : [],
    );

    for (const { month, step } of stories) {
      expect(step.reported.includes("EVENT-REPORTED")).toBe(month === 2);
      expect(step.happened.includes("EVENT-HAPPENED")).toBe(month === 2);
    }
  });

  it("gives the same events for the same seed", () => {
    const seeded = parseContent(
      raw([outside({ schedule: { months: [1, 2, 3, 4], chance: 0.3 } })]),
    );
    const months = new Set<number | undefined>();
    for (let seed = 0; seed < 40; seed++) {
      const once = play(startRun({ seed, content: seeded }));

      expect(JSON.stringify(play(startRun({ seed, content: seeded })))).toBe(
        JSON.stringify(once),
      );
      months.add(landed(once)[0]?.month);
    }
    expect(months.size).toBeGreaterThan(2);
  });

  it("lands once, at most, in a run", () => {
    const seeded = parseContent(
      raw([outside({ schedule: { months: [1, 2, 3, 4], chance: 0.6 } })]),
    );
    for (let seed = 0; seed < 40; seed++) {
      const views = play(startRun({ seed, content: seeded }));
      expect(landed(views).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("a Company Event from a hidden risk", () => {
  const content = parseContent(
    raw([{ ...outside({ id: "breach" }), schedule: undefined }], {
      notifications: [
        {
          id: "budget",
          months: [1],
          from: "Finance",
          subject: "A budget",
          body: "Cut what?",
          options: [
            { id: "skimp", label: "Skimp", sets: ["skimped"] },
            { id: "keep", label: "Keep it" },
          ],
        },
      ],
      risks: [
        {
          id: "r",
          addedBy: "skimped",
          after: { min: 2, max: 2 },
          note: "N",
          event: "breach",
          route: { character: "ben", chance: certain, motive: "M" },
          traced: { did: "skimped" },
          onPlayer: { id: "you", as: "notice", title: "T", body: "B" },
          landedOnYou: "L",
          landedElsewhere: "E",
          neverCameOut: "Q",
        },
      ],
    }),
  );
  const answer = (optionId: string) => {
    const run = startRun({ seed: 1, content });
    run.choose({ type: "notification", notificationId: "budget", optionId });
    return play(run);
  };

  it("happens only after the choice that caused it", () => {
    expect(landed(answer("skimp")).map((v) => v.month)).toEqual([3]);
    expect(landed(answer("keep"))).toEqual([]);
  });

  it("gives the same events for the same seed and choices", () => {
    expect(JSON.stringify(answer("skimp"))).toBe(
      JSON.stringify(answer("skimp")),
    );
  });
});

describe("a disaster with no clue", () => {
  const disaster = (extra: object = {}) => ({
    id: "flood",
    from: "Facilities",
    title: "A-DISASTER",
    body: "Water.",
    story,
    disaster: true,
    ...extra,
  });
  const atRate = (disasterChance: number) => {
    const base = raw([disaster()]);
    return parseContent({
      ...base,
      balance: { ...base.balance, disasterChance },
    });
  };

  it("arrives at the rate in the balance data", () => {
    const count = (chance: number) => {
      const content = atRate(chance);
      return Array.from({ length: 100 }, (_, seed) =>
        landed(play(startRun({ seed, content }))),
      ).filter((l) => l.length > 0).length;
    };

    expect(count(0)).toBe(0);
    expect(count(1)).toBe(100);
    const some = count(0.15);
    expect(some).toBeGreaterThan(20);
    expect(some).toBeLessThan(75);
  });

  it("leaves no clue beforehand", () => {
    const content = atRate(1);
    const views = play(startRun({ seed: 1, content }));

    expect(views.at(-1)?.notebook.clues).toEqual([]);
  });

  it("cannot be written as a big mistake", () => {
    const base = raw([disaster({ mistake: "big" })]);
    expect(() => parseContent(base)).toThrow(ContentError);
  });

  it("does not put the player on a Final Warning", () => {
    const views = play(startRun({ seed: 1, content: atRate(1) }));

    expect(landed(views).length).toBeGreaterThan(0);
    expect(views.at(-1)?.finalWarning).toBe(false);
  });

  it("cannot start a Thread that is a big mistake", () => {
    const base = raw([disaster({ sets: ["flooded"] })], {
      mistakes: {
        finalWarning: { title: "W", body: "B" },
        fired: { title: "F", body: "B" },
        firedOutright: { title: "O", body: "B" },
        results: { title: "E", intro: "I" },
        firedIn: "{month}",
        finished: "L",
      },
      threads: [
        {
          id: "t",
          startedBy: "flooded",
          after: { min: 1, max: 1 },
          started: "S",
          outcomes: [
            {
              playedOut: "P",
              bill: {
                id: "b",
                as: "notice",
                title: "T",
                body: "B",
                mistake: "big",
              },
            },
          ],
        },
      ],
    });
    expect(() => parseContent(base)).toThrow(/disaster starts/);
  });

  it("does not repeat in a run", () => {
    const views = play(startRun({ seed: 1, content: atRate(1) }));

    expect(landed(views)).toHaveLength(1);
  });
});

describe("a scheduled event with a clue", () => {
  it("leaves the clue in the Notebook, the given months before", () => {
    const content = parseContent(
      raw([
        outside({
          schedule: {
            months: [3],
            chance: 1,
            clue: { before: 2, source: "THE-LIFT", text: "CLUE-WORDS" },
          },
        }),
      ]),
    );

    const views = play(startRun({ seed: 1, content }));

    expect(views.at(-1)?.notebook.clues).toEqual([
      { month: 1, source: "THE-LIFT", text: "CLUE-WORDS" },
    ]);
    expect(landed(views)[0]?.month).toBe(3);
  });
});

describe("a reshuffle", () => {
  const moved = (reshuffle: object) =>
    parseContent(raw([outside({ reshuffle, changed: "IT-CHANGED" })]));
  const managerOf = (view: PlayerView | undefined, name: string) =>
    view?.orgChart.find((e) => e.name === name)?.reportsTo;

  it("changes the Org Chart from that point on", () => {
    const content = moved({ reports: [{ character: "cal", to: "ben" }] });
    const views = play(startRun({ seed: 1, content }));

    expect(managerOf(views[0], "Cal Cope")).toBe("Ana Abel");
    expect(managerOf(landed(views)[0], "Cal Cope")).toBe("Ben Bird");
    expect(managerOf(views.at(-1), "Cal Cope")).toBe("Ben Bird");
  });

  it("does not make a loop on the Org Chart", () => {
    const content = moved({
      reports: [
        { character: "cal", to: "ben" },
        { character: "ben", to: "cal" },
      ],
    });
    const views = play(startRun({ seed: 1, content }));

    expect(managerOf(views.at(-1), "Cal Cope")).toBe("Ben Bird");
    expect(managerOf(views.at(-1), "Ben Bird")).toBe("Ana Abel");
  });

  it("does not make a loop through who someone already answered to", () => {
    // Ana has answered to nobody, and Ben to Ana, since before the run began.
    const base = raw([
      outside({
        changed: "C",
        reshuffle: { reports: [{ character: "ben", to: "cal" }] },
      }),
    ]);
    const cal = base.characters.find((c) => c.id === "cal");
    if (cal) cal.reportsTo = "ben";
    const views = play(startRun({ seed: 1, content: parseContent(base) }));

    expect(managerOf(views.at(-1), "Ben Bird")).toBe("Ana Abel");
  });

  it("changes who later signs point to", () => {
    const base = raw([
      outside({ changed: "C", reshuffle: { rises: ["cal"] } }),
    ]);
    const seat = {
      ...base.actions[0],
      id: "room",
      scene: "room",
      result: undefined,
    };
    const content = parseContent({
      ...base,
      actions: [seat, ...base.actions.slice(1)],
      scenes: [
        {
          id: "room",
          title: "A room",
          location: "Here",
          narration: ["People."],
          cast: ["ana", "ben", "cal"],
          signs: [{ label: "L", text: "{holder} HOLDS-THE-ROOM" }],
          options: [{ id: "o", label: "O", results: [{ body: "B" }] }],
        },
      ],
    });
    const seed = [...Array(30).keys()].find(
      (s) =>
        readHiddenTruth(startRun({ seed: s, content })).powerMap.order[0] !==
        "cal",
    );
    if (seed === undefined) throw new Error("No such deal.");
    const signs = play(startRun({ seed, content })).flatMap((v) =>
      v.step.kind === "scene"
        ? [{ month: v.month, said: v.step.signs[0]?.text ?? "" }]
        : [],
    );

    const before = signs.filter((s) => s.month === 1);
    const after = signs.filter((s) => s.month >= 3);
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);
    for (const { said } of before) expect(said).not.toContain("Cal Cope");
    for (const { said } of after) expect(said).toContain("Cal Cope");
  });

  it("changes the Power Map, which later conditions read", () => {
    const content = moved({ rises: ["cal"] });
    const run = startRun({ seed: 2, content });
    const before = readHiddenTruth(run).powerMap.order;

    play(run);

    const { order, influence } = readHiddenTruth(run).powerMap;
    expect(order[0]).toBe("cal");
    expect([...order].sort()).toEqual([...before].sort());
    expect(influence).toHaveLength(order.length - 1);
  });

  it("is on the results screen, as the charts ended up and what changed them", () => {
    const content = moved({
      reports: [{ character: "cal", to: "ben" }],
      rises: ["cal"],
    });
    const views = play(startRun({ seed: 1, content }));
    const results = resultsOf(views);

    expect(results.changes).toEqual([
      { month: 2, title: "THE-EVENT", changed: "IT-CHANGED" },
    ]);
    expect(results.powerMap.find((e) => e.name === "Cal Cope")?.reportsTo).toBe(
      null,
    );
    expect(managerOf(views.at(-1), "Cal Cope")).toBe("Ben Bird");
  });

  it("does not put the Power Map in the player view during play", () => {
    const content = moved({ rises: ["cal"] });
    const views = play(startRun({ seed: 1, content }));

    for (const view of views.slice(0, -1)) {
      expect(JSON.stringify(view)).not.toContain("powerMap");
      expect(JSON.stringify(view)).not.toContain("influence");
    }
  });
});

describe("the Power Map's moves", () => {
  const map: PowerMap = {
    order: ["a", "b", "c", "d"],
    influence: [
      { who: "a", over: "b" },
      { who: "b", over: "c" },
      { who: "b", over: "d" },
    ],
  };
  /** Each person after the first comes under someone before them. */
  const expectTree = ({ order, influence }: PowerMap) => {
    expect(influence).toHaveLength(order.length - 1);
    for (const [index, id] of order.entries()) {
      const above = influence.filter((i) => i.over === id);
      if (index === 0) {
        expect(above).toEqual([]);
      } else {
        expect(above).toHaveLength(1);
        expect(order.indexOf(above[0]?.who ?? "")).toBeLessThan(index);
      }
    }
  };

  it.each(["a", "b", "c", "d"])("keeps a tree when raising %s", (id) => {
    const raised = raiseOnMap(map, id);
    expect(raised.order[0]).toBe(id);
    expectTree(raised);
  });

  it.each(["a", "b", "c", "d"])("keeps a tree when lowering %s", (id) => {
    const lowered = lowerOnMap(map, id);
    expect(lowered.order.at(-1)).toBe(id);
    expectTree(lowered);
  });
});

describe("what is written", () => {
  const refuses = (event: object, extra: object = {}) => {
    expect(() => parseContent(raw([outside(event)], extra))).toThrow(
      ContentError,
    );
  };

  it("refuses an event with no way to land", () => {
    refuses({ schedule: undefined });
  });

  it("refuses an event with two ways to land", () => {
    refuses({ disaster: true });
  });

  it("refuses moving the boss on the chart", () => {
    refuses({
      changed: "C",
      reshuffle: { reports: [{ character: "ana", to: "ben" }] },
    });
  });

  it("refuses a chart change with no words for the results screen", () => {
    refuses({ reshuffle: { rises: ["ben"] } });
  });

  it("refuses words for a chart change that did not happen", () => {
    refuses({ changed: "C" });
  });

  it("refuses a month past the run", () => {
    refuses({ schedule: { months: [99], chance: 1 } });
  });

  it("refuses someone who does not exist", () => {
    refuses({ changed: "C", reshuffle: { falls: ["nobody"] } });
  });
});

describe("the real Company Events", () => {
  const count = (test: (e: (typeof gameContent.events)[number]) => boolean) =>
    gameContent.events.filter(test).length;

  it("has one from a hidden risk, from outside, and with no clue", () => {
    const fromRisks = gameContent.risks.flatMap((r) => r.event ?? []);

    expect(fromRisks.length).toBeGreaterThan(0);
    expect(count((e) => e.schedule !== undefined)).toBeGreaterThan(0);
    expect(count((e) => e.disaster)).toBeGreaterThan(0);
    expect(gameContent.balance.disasterChance).toBeGreaterThan(0);
  });

  it("never moves your boss off the chart", () => {
    const { character } = gameContent.boss;
    const moved = gameContent.events.flatMap((e) =>
      e.reshuffle.reports.map((r) => r.character),
    );
    expect(moved).not.toContain(character);
  });

  it("lands somewhere on most deals, and not always in the same place", () => {
    const months = new Set<number>();
    let runs = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const views = play(startRun({ seed, content: gameContent }));
      for (const view of landed(views)) months.add(view.month);
      if (landed(views).length > 0) runs += 1;
    }
    expect(runs).toBeGreaterThan(20);
    expect(months.size).toBeGreaterThan(2);
  });
});
