import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  startRun,
  type Choice,
  type Content,
  type Kind,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { action, emptyMonthRaw } from "./fixture";

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const notice = { title: "Done", body: "Done." };

function reportFixtureRaw() {
  const raw = emptyMonthRaw();
  raw.balance.monthsPerRun = 3;
  const notifications = [
    {
      id: "report",
      from: "Boss",
      subject: "Report",
      body: "It is really {real}, and reported as {reported}.",
      options: [
        {
          id: "do",
          label: "Do it",
          cost: "report",
          project: { reported: "real" },
          result: notice,
        },
        {
          id: "lie",
          label: "Lie in it",
          cost: "report",
          project: { reported: "good" },
          result: notice,
        },
        {
          id: "skip",
          label: "Skip it",
          project: { reported: "worse" },
          result: notice,
        },
      ],
    },
  ];
  return {
    ...raw,
    notifications,
    actions: [
      { ...action("desk"), project: { real: "better" } },
      action("kettle"),
      action("copier"),
      action("plant"),
    ],
  };
}

const answer = (optionId: string): Choice => ({
  type: "notification",
  notificationId: "report",
  optionId,
});

/** Spends what is left of a month on the kettle, until the next one opens. */
function finishMonth(run: Run): PlayerView {
  let view = run.view();
  const { month } = view;
  while (view.month === month && view.step.kind !== "results") {
    const kettle = view.choices.find(
      (c) => c.type === "action" && c.actionId === "kettle",
    );
    const next = kettle ?? view.choices[0];
    if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(next);
  }
  return view;
}

describe("a Project", () => {
  it("has an owner, a real status and a reported status from the first step", () => {
    const content = parseContent(reportFixtureRaw());
    const { project } = startRun({ seed: 1, content }).view();

    expect(project).toMatchObject({
      name: "PROJECT-NAME",
      owner: "PROJECT-OWNER",
      real: "STATUS-FAIR",
      reported: "STATUS-GOOD",
    });
  });

  it("shows both statuses in the report's own words", () => {
    const content = parseContent(reportFixtureRaw());
    const { step } = startRun({ seed: 1, content }).view();

    expect(step).toMatchObject({
      body: "It is really STATUS-FAIR, and reported as STATUS-GOOD.",
    });
  });

  it("sets the reported status apart from the real one when you lie", () => {
    const raw = reportFixtureRaw();
    raw.project.start = { real: "bad", reported: "bad" };
    const run = startRun({ seed: 1, content: parseContent(raw) });

    const { project } = run.choose(answer("lie"));

    expect(project.real).toBe("STATUS-BAD");
    expect(project.reported).toBe("STATUS-GOOD");
  });

  it("brings the reported status back to the real one when you do it", () => {
    const run = startRun({
      seed: 1,
      content: parseContent(reportFixtureRaw()),
    });

    expect(run.choose(answer("do")).project.reported).toBe("STATUS-FAIR");
  });

  it("makes the reported status worse if you skip it", () => {
    const run = startRun({
      seed: 1,
      content: parseContent(reportFixtureRaw()),
    });

    expect(run.choose(answer("skip")).project.reported).toBe("STATUS-FAIR");
  });

  it("improves the real status when you do the work, and only the real one", () => {
    const raw = reportFixtureRaw();
    raw.project.start = { real: "bad", reported: "bad" };
    const run = startRun({ seed: 1, content: parseContent(raw) });
    run.choose(answer("skip"));
    run.choose({ type: "continue" });

    const { project } = run.choose({ type: "action", actionId: "desk" });

    expect(project.real).toBe("STATUS-FAIR");
    expect(project.reported).toBe("STATUS-BAD");
  });

  it("goes no better than the best status and no worse than the worst", () => {
    const raw = reportFixtureRaw();
    raw.project.start = { real: "good", reported: "bad" };
    const run = startRun({ seed: 1, content: parseContent(raw) });
    const skipped = run.choose(answer("skip"));
    run.choose({ type: "continue" });

    const worked = run.choose({ type: "action", actionId: "desk" });

    expect(skipped.project.reported).toBe("STATUS-BAD");
    expect(worked.project.real).toBe("STATUS-GOOD");
  });

  it("carries both statuses across months, changed by nothing but choices", () => {
    const raw = reportFixtureRaw();
    raw.project.start = { real: "bad", reported: "bad" };
    const run = startRun({ seed: 7, content: parseContent(raw) });
    run.choose(answer("lie"));

    const next = finishMonth(run);

    expect(next.month).toBe(2);
    expect(next.project.real).toBe("STATUS-BAD");
    expect(next.project.reported).toBe("STATUS-GOOD");
  });

  it("is moved by written events as a month opens, and says so", () => {
    const raw = reportFixtureRaw();
    raw.project.events = [
      { months: [2], text: "EVENT-WORSE", project: { real: "worse" } },
    ];
    const run = startRun({ seed: 7, content: parseContent(raw) });
    run.choose(answer("do"));

    const next = finishMonth(run);

    expect(next.project.real).toBe("STATUS-BAD");
    expect(next.project.reported).toBe("STATUS-FAIR");
    expect(next.project.news).toEqual([{ month: 2, text: "EVENT-WORSE" }]);
  });

  it("is the same whichever seed plays the same choices", () => {
    const content = parseContent(reportFixtureRaw());
    const statuses = new Set(
      SEEDS.slice(0, 20).map((seed) => {
        const run = startRun({ seed, content });
        run.choose(answer("lie"));
        const { real, reported } = finishMonth(run).project;
        return `${real}/${reported}`;
      }),
    );

    expect(statuses.size).toBe(1);
  });
});

describe("a Project in content", () => {
  it("refuses a change to an unknown status", () => {
    const raw = reportFixtureRaw();
    raw.project.start = { real: "nonsense", reported: "good" };

    expect(() => parseContent(raw)).toThrow(/unknown status "nonsense"/);
  });

  it("refuses a real status that claims to come from itself", () => {
    const raw = reportFixtureRaw();
    raw.project.events = [
      { months: [2], text: "Oh.", project: { real: "real" } },
    ];

    expect(() => parseContent(raw)).toThrow(/unknown status "real"/);
  });

  it("refuses a report that uses a token it cannot fill", () => {
    const raw = reportFixtureRaw();
    const [report] = raw.notifications;
    if (report) report.body = "It is {nonsense}.";

    expect(() => parseContent(raw)).toThrow(/unknown token "\{nonsense\}"/);
  });
});

const BOSS = gameContent.boss.character;

function dealtBoss(run: Run): Kind | undefined {
  return readHiddenTruth(run).characters.find((c) => c.id === BOSS)?.kind;
}

function seedWithBoss(kind: Kind, content: Content = gameContent): number {
  const seed = SEEDS.find(
    (s) => dealtBoss(startRun({ seed: s, content })) === kind,
  );
  if (seed === undefined) throw new Error(`No seed deals a ${kind} boss.`);
  return seed;
}

/** Answers everything for free, or by filing the report, to reach the floor. */
function reachFloor(run: Run, report = "report"): PlayerView {
  let view = run.view();
  while (view.step.kind !== "actions") {
    const { step } = view;
    if (step.kind === "notification") {
      const wanted =
        step.options.find((o) => o.id === report) ??
        step.options.find((o) => o.id === "chase");
      const free = step.options.find((o) => o.costLabel === "Costs nothing");
      const option = wanted ?? free ?? step.options[0];
      if (!option) throw new Error("A Notification with no options.");
      view = run.choose({
        type: "notification",
        notificationId: step.id,
        optionId: option.id,
      });
    } else {
      const next = view.choices[0];
      if (!next) throw new Error(`Stuck at ${step.kind}.`);
      view = run.choose(next);
    }
  }
  return view;
}

function deliver(run: Run) {
  const view = run.choose({ type: "action", actionId: "work" });
  if (view.step.kind !== "notice") throw new Error(view.step.kind);
  return view.step;
}

describe("the Monthly Status Report in the game", () => {
  it("arrives every month, and offers to do it, skip it or lie in it", () => {
    const run = startRun({ seed: 1, content: gameContent });
    const seen: number[] = [];
    let view = run.view();
    while (view.step.kind !== "results") {
      if (view.step.kind === "notification") {
        const ids = view.step.options.map((o) => o.id);
        if (view.step.id === "monthly-report") {
          seen.push(view.month);
          expect(ids).toEqual(["report", "lie", "skip"]);
        }
      }
      const choice = view.choices.at(0);
      if (!choice) throw new Error(`Stuck at ${view.step.kind}.`);
      view = run.choose(choice);
    }

    expect(seen).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("costs what the balance data says to file", () => {
    const report = gameContent.notifications.find(
      (n) => n.id === "monthly-report",
    );
    const cost = (id: string) => report?.options.find((o) => o.id === id)?.cost;

    expect(gameContent.balance.actionCosts[cost("report") ?? ""]).toBe(1);
    expect(gameContent.balance.actionCosts[cost("lie") ?? ""]).toBe(1);
    expect(cost("skip")).toBeUndefined();
  });

  it("shows a lie as a gap between the two statuses, on any boss", () => {
    for (const kind of ["believer", "incompetent", "practitioner"] as const) {
      const run = startRun({ seed: seedWithBoss(kind), content: gameContent });
      const { project } = reachFloor(run, "lie");

      expect(project.reported, kind).toBe("Green");
      expect(project.real, kind).toBe("Amber");
    }
  });

  it("is what brings the reported status down to the real one", () => {
    const run = startRun({ seed: 1, content: gameContent });

    const { project } = reachFloor(run, "report");

    expect(project.reported).toBe("Amber");
  });
});

describe("Deliver", () => {
  it("improves the real status of the Project", () => {
    const run = startRun({ seed: 1, content: gameContent });
    reachFloor(run);

    expect(run.choose({ type: "action", actionId: "work" }).project.real).toBe(
      "Green",
    );
  });

  it("lands differently with a Practitioner boss than with a Believer", () => {
    const landed = (kind: Kind) => {
      const run = startRun({ seed: seedWithBoss(kind), content: gameContent });
      reachFloor(run);
      const before = readHiddenTruth(run).bossOpinion;
      const { reaction } = deliver(run);
      return { reaction, shift: readHiddenTruth(run).bossOpinion - before };
    };

    expect(landed("practitioner").reaction).not.toEqual(
      landed("believer").reaction,
    );
    expect(landed("believer").shift).toBeGreaterThan(
      landed("practitioner").shift,
    );
  });

  it("lets only a Practitioner boss take the credit in a Move", () => {
    const credit = gameContent.moves.find((m) => m.id === "credit-taken");
    const creditLanded = (kind: Kind) =>
      SEEDS.slice(0, 60).some((seed) => {
        const run = startRun({ seed, content: gameContent });
        if (dealtBoss(run) !== kind) return false;
        reachFloor(run);
        run.choose({ type: "action", actionId: "work" });
        run.choose({ type: "continue" });
        let view = run.view();
        while (view.step.kind !== "move" && view.step.kind !== "story") {
          const meeting = view.choices.find(
            (c) => c.type === "action" && c.actionId === "meeting",
          );
          const next = meeting ?? view.choices.at(-1);
          if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
          view = run.choose(next);
        }
        return view.step.kind === "move" && view.step.title === credit?.title;
      });

    expect(creditLanded("practitioner")).toBe(true);
    expect(creditLanded("believer")).toBe(false);
    expect(creditLanded("incompetent")).toBe(false);
  });

  it("cools a Practitioner boss towards a player who shines too much", () => {
    const run = startRun({
      seed: seedWithBoss("practitioner"),
      content: gameContent,
    });
    const shifts: number[] = [];
    for (let done = 0; done < 3; done++) {
      reachFloor(run, done === 0 ? "report" : "skip");
      const before = readHiddenTruth(run).bossOpinion;
      deliver(run);
      shifts.push(readHiddenTruth(run).bossOpinion - before);
      finishMonth(run);
    }

    expect(shifts[0]).toBeGreaterThan(0);
    expect(shifts[2]).toBeLessThan(0);
  });

  it("never cools a Believer boss, however well you do", () => {
    const run = startRun({
      seed: seedWithBoss("believer"),
      content: gameContent,
    });
    for (let done = 0; done < 3; done++) {
      reachFloor(run, "report");
      const before = readHiddenTruth(run).bossOpinion;
      deliver(run);

      expect(readHiddenTruth(run).bossOpinion).toBeGreaterThan(before);
      finishMonth(run);
    }
  });
});
