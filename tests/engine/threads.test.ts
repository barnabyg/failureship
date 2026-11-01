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
import { fixtureRaw } from "./fixture";

const mistakes = {
  finalWarning: { title: "WARNED", body: "One more." },
  fired: { title: "FIRED", body: "That was one more." },
  firedOutright: { title: "FIRED-OUTRIGHT", body: "That was all it took." },
  results: { title: "ENDED", intro: "It ended." },
  firedIn: "FIRED-IN {month}",
  finished: "LASTED",
};

const bill = {
  id: "the-bill",
  as: "notice",
  title: "THE-BILL",
  body: "It has come back.",
  sets: ["billed"],
};

function raw(thread: object = {}, billChange: object = {}) {
  const base = fixtureRaw();
  base.balance.monthsPerRun = 4;
  base.notifications = [
    {
      id: "offer",
      months: [1],
      from: "HR",
      subject: "An offer",
      body: "Do it?",
      options: [
        { id: "do-it", label: "Do it", sets: ["did-it"] },
        { id: "leave-it", label: "Leave it" },
      ],
    },
  ];
  return {
    ...base,
    mistakes,
    threads: [
      {
        id: "t",
        startedBy: "did-it",
        after: { min: 2, max: 2 },
        started: "STARTED-WORDS",
        outcomes: [
          { playedOut: "PLAYED-WORDS", bill: { ...bill, ...billChange } },
        ],
        ...thread,
      },
    ],
  };
}

/** Plays the whole run, answering the offer as told, and keeps every view. */
function play(run: Run, optionId: string): PlayerView[] {
  const views = [
    run.choose({ type: "notification", notificationId: "offer", optionId }),
  ];
  let view = views[0] as PlayerView;
  while (view.choices.length > 0) {
    view = run.choose(view.choices[0] as Choice);
    views.push(view);
  }
  return views;
}

function resultsOf(views: PlayerView[]) {
  const { step } = views.at(-1) as PlayerView;
  if (step.kind !== "results") throw new Error(step.kind);
  return step;
}

const noticeOf = (views: PlayerView[], title: string) =>
  views.find((v) => v.step.kind === "notice" && v.step.title === title);

describe("a Thread", () => {
  const content = parseContent(raw());

  it("plays out in a later month because of a choice in an earlier one", () => {
    const views = play(startRun({ seed: 1, content }), "do-it");

    expect(noticeOf(views, "THE-BILL")?.month).toBe(3);
  });

  it("does nothing if the choice was never made", () => {
    const views = play(startRun({ seed: 1, content }), "leave-it");

    expect(noticeOf(views, "THE-BILL")).toBeUndefined();
    expect(resultsOf(views).threads).toEqual([]);
  });

  it("traces back to what started it on the results screen", () => {
    const views = play(startRun({ seed: 1, content }), "do-it");

    expect(resultsOf(views).threads).toEqual([
      {
        startedIn: 1,
        started: "STARTED-WORDS",
        playedIn: 3,
        playedOut: "PLAYED-WORDS",
      },
    ]);
  });

  it("gives the same outcome for the same choices, and another for others", () => {
    const content = parseContent(
      raw({ chance: 0.5, after: { min: 1, max: 3 } }),
    );
    const twice = (seed: number, option: string) =>
      JSON.stringify(play(startRun({ seed, content }), option));
    for (let seed = 0; seed < 20; seed++) {
      expect(twice(seed, "do-it")).toBe(twice(seed, "do-it"));
    }
    const months = Array.from({ length: 200 }, (_, seed) => {
      const views = play(startRun({ seed, content }), "do-it");
      return noticeOf(views, "THE-BILL")?.month;
    });

    expect(new Set(months)).toEqual(new Set([undefined, 2, 3, 4]));
  });

  it("leaves the shared random state alone", () => {
    const moves = [
      { id: "m1", from: "F", title: "M1", body: "B" },
      { id: "m2", from: "F", title: "M2", body: "B" },
      { id: "m3", from: "F", title: "M3", body: "B" },
    ];
    const withThread = parseContent({ ...raw(), moves });
    const without = parseContent({ ...raw(), moves, threads: [] });
    const titles = (c: typeof withThread, seed: number) =>
      play(startRun({ seed, content: c }), "do-it").flatMap((v) =>
        v.step.kind === "move" ? [v.step.title] : [],
      );

    for (let seed = 0; seed < 20; seed++) {
      expect(titles(withThread, seed)).toEqual(titles(without, seed));
    }
  });

  it("chooses its outcome by what has held since", () => {
    const content = parseContent(
      raw({
        outcomes: [
          {
            when: { did: "never-set" },
            playedOut: "P",
            bill: { ...bill, id: "other", title: "OTHER" },
          },
          { playedOut: "P", bill },
        ],
      }),
    );

    const views = play(startRun({ seed: 1, content }), "do-it");

    expect(noticeOf(views, "OTHER")).toBeUndefined();
    expect(noticeOf(views, "THE-BILL")).toBeDefined();
  });

  it("comes to nothing if no outcome holds", () => {
    const content = parseContent(
      raw({
        outcomes: [{ when: { did: "never-set" }, playedOut: "P", bill }],
      }),
    );

    const views = play(startRun({ seed: 1, content }), "do-it");

    expect(resultsOf(views).threads).toEqual([]);
  });

  it("shows no sign in the player view before it plays out", () => {
    const run = startRun({ seed: 1, content });
    const [first, ...rest] = play(run, "do-it");
    const before = [first, ...rest].filter(
      (v) => v && v.month < 3 && v.step.kind !== "results",
    );
    const leaveIt = play(startRun({ seed: 1, content }), "leave-it");

    expect(before.length).toBeGreaterThan(0);
    for (const view of before) {
      const said = JSON.stringify(view);
      for (const word of [
        "STARTED-WORDS",
        "PLAYED-WORDS",
        "THE-BILL",
        "the-bill",
        "billed",
        "thread",
      ]) {
        expect(said).not.toContain(word);
      }
    }
    // Apart from the answer itself, it reads exactly as if it had not started.
    expect(JSON.stringify(before.at(-1)?.choices)).toBe(
      JSON.stringify(
        leaveIt.find((v) => v.month === 2 && v.step.kind === "story")?.choices,
      ),
    );
  });
});

describe("a Bill", () => {
  it("can reach the player as a Character Move, from someone else", () => {
    const content = parseContent(
      raw({}, { as: "move", from: "THROUGH-SOMEONE" }),
    );

    const views = play(startRun({ seed: 1, content }), "do-it");

    const landed = views.find(
      (v) => v.step.kind === "move" && v.step.title === "THE-BILL",
    );
    expect(landed?.month).toBe(3);
    expect(landed?.step).toMatchObject({ from: "THROUGH-SOMEONE" });
  });

  it("can arrive as a Notification, with answers of its own", () => {
    const content = parseContent(
      raw(
        {},
        {
          as: "notification",
          from: "THROUGH-SOMEONE",
          options: [{ id: "answer", label: "ANSWER" }],
        },
      ),
    );
    const run = startRun({ seed: 1, content });

    const views = play(run, "do-it");

    const landed = views.find(
      (v) => v.step.kind === "notification" && v.step.id === "the-bill",
    );
    expect(landed?.month).toBe(3);
  });

  it("can be a big mistake, with no code written for it", () => {
    const content = parseContent(raw({}, { mistake: "big" }));

    const views = play(startRun({ seed: 1, content }), "do-it");

    expect(views.at(-1)?.finalWarning).toBe(true);
    expect(resultsOf(views).mistakes).toEqual([
      { month: 3, choice: "THE-BILL" },
    ]);
  });

  it("can pay off rather than backfire", () => {
    const content = parseContent(raw({}, { project: { real: "better" } }));
    const views = play(startRun({ seed: 1, content }), "do-it");

    expect(views.at(-1)?.project.real).toBe("STATUS-GOOD");
  });
});

describe("what is written", () => {
  const refuses = (thread: object, billChange: object = {}) => {
    expect(() => parseContent(raw(thread, billChange))).toThrow(ContentError);
  };

  it("refuses a Thread that nothing starts", () => {
    refuses({ startedBy: "nobody-sets-this" });
  });

  it("refuses a wait that makes no sense", () => {
    refuses({ after: { min: 3, max: 1 } });
  });

  it("refuses a Move with nobody for it to come through", () => {
    refuses({}, { as: "move" });
  });

  it("refuses a Bill that could trap the player with no free answer", () => {
    refuses(
      {},
      {
        as: "notification",
        from: "F",
        options: [{ id: "a", label: "A", cost: "standard" }],
      },
    );
  });

  it("refuses a Bill that fires the player with no warning", () => {
    refuses({}, { mistake: "catastrophic" });
  });

  it("refuses a Bill whose id is taken", () => {
    refuses({}, { id: "offer" });
  });
});

describe("the real Threads", () => {
  const thread = (id: string) => {
    const found = gameContent.threads.find((t) => t.id === id);
    if (!found) throw new Error(id);
    return found;
  };
  const bills = (id: string) => thread(id).outcomes.map((o) => o.bill);

  it("has the desk with no window, starting from a choice about desks", () => {
    const desks = gameContent.notifications.find((n) => n.id === "desk-moves");

    expect(
      desks?.options.some((o) =>
        o.sets.includes(thread("desk-no-window").startedBy),
      ),
    ).toBe(true);
  });

  it("has a Thread that pays off", () => {
    expect(bills("blame-taken").some((b) => b.opinion > 0)).toBe(true);
  });

  it("has a Thread from a lie in the Monthly Status Report", () => {
    const report = gameContent.notifications.find(
      (n) => n.id === "monthly-report",
    );

    expect(report?.options.find((o) => o.id === "lie")?.sets).toContain(
      thread("green-report").startedBy,
    );
    expect(bills("green-report").some((b) => b.mistake === "big")).toBe(true);
  });

  it("leaves some Moves with no Bill", () => {
    const started = new Set(gameContent.threads.map((t) => t.startedBy));
    const unbilled = gameContent.notifications
      .flatMap((n) => n.options)
      .filter((o) => !o.sets.some((flag) => started.has(flag)));

    expect(unbilled.length).toBeGreaterThan(0);
  });

  it("leaves the desk's Bill room to come months later", () => {
    const desks = gameContent.notifications.find((n) => n.id === "desk-moves");
    const month = desks?.months?.[0] ?? 99;

    expect(month + thread("desk-no-window").after.max).toBeLessThanOrEqual(
      gameContent.balance.monthsPerRun,
    );
  });
});
