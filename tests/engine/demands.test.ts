import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  KINDS,
  parseContent,
  startRun,
  type Choice,
  type Content,
  type Kind,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { emptyMonthRaw } from "./fixture";

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
const notice = { title: "Done", body: "Done." };

const option = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  label: id,
  result: notice,
  ...extra,
});

const lines = (word: string) => ({
  believer: [`${word}-BELIEVER`],
  incompetent: [`${word}-INCOMPETENT`],
  practitioner: [`${word}-PRACTITIONER`],
});

/** A Demand in month 1 of 4, which a stall can carry through later months. */
function demandFixtureRaw() {
  const raw = emptyMonthRaw();
  raw.balance.monthsPerRun = 4;
  raw.boss.approaches = [
    {
      id: "work",
      shift: { believer: 2, incompetent: -1, practitioner: 1 },
      reaction: lines("WORK"),
    },
    {
      id: "show",
      shift: { believer: -2, incompetent: 2, practitioner: 1 },
      reaction: lines("SHOW"),
    },
  ];
  return {
    ...raw,
    demands: {
      odds: {
        believer: { forgets: 0.2, chases: 0.4 },
        incompetent: { forgets: 0.6, chases: 0.1 },
        practitioner: { forgets: 0.3, chases: 0.3 },
      },
      chasedPenalty: { believer: -2, incompetent: -2, practitioner: -2 },
      items: [
        {
          id: "tool",
          months: [1],
          from: "Boss",
          subject: "DEMAND-SUBJECT",
          body: "Roll it out.",
          options: [
            option("deliver", { cost: "standard", approach: "work" }),
            option("push-back"),
            option("hand-off"),
            option("fake", { approach: "show" }),
            option("stall", { stalls: true }),
          ],
          forgotten: { title: "FORGOTTEN", body: "It went away." },
          chased: {
            from: "Boss",
            subject: "CHASED",
            body: "Well?",
            options: [
              option("late", { cost: "standard", approach: "work" }),
              option("excuse"),
            ],
          },
        },
      ],
    },
  };
}

const answer = (optionId: string): Choice => ({
  type: "notification",
  notificationId: "tool",
  optionId,
});

function bossKind(run: Run, boss = "ana"): Kind {
  const kind = readHiddenTruth(run).characters.find((c) => c.id === boss)?.kind;
  if (kind === undefined) throw new Error("No boss was dealt.");
  return kind;
}

function seedWithBoss(kind: Kind, content: Content, boss = "ana"): number {
  const seed = SEEDS.find(
    (s) => bossKind(startRun({ seed: s, content }), boss) === kind,
  );
  if (seed === undefined) throw new Error(`No seed deals a ${kind} boss.`);
  return seed;
}

/** Carries on until something other than a closing month needs an answer. */
function nextMonth(run: Run): PlayerView {
  let view = run.view();
  const { month } = view;
  while (view.month === month && view.step.kind !== "results") {
    const next = view.choices[0];
    if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(next);
  }
  return view;
}

/** What became of a Demand stalled on this seed, by the end of the run. */
function afterStalling(seed: number, content: Content) {
  const run = startRun({ seed, content });
  run.choose(answer("stall"));
  run.choose({ type: "continue" });
  let view = run.view();
  while (view.step.kind !== "results") {
    if (view.step.kind === "notification") return "chased";
    if (view.step.kind === "notice" && view.step.title === "FORGOTTEN") {
      return "forgotten";
    }
    view = nextMonth(run);
  }
  return "still open";
}

describe("a stalled Demand", () => {
  const content = () => parseContent(demandFixtureRaw());

  it("stays open, and the player can see it", () => {
    const run = startRun({ seed: 1, content: content() });

    const { openDemands } = run.choose(answer("stall"));

    expect(openDemands).toEqual([{ month: 1, subject: "DEMAND-SUBJECT" }]);
  });

  it("is not open if answered any other way", () => {
    for (const other of ["deliver", "push-back", "hand-off", "fake"]) {
      const run = startRun({ seed: 1, content: content() });

      expect(run.choose(answer(other)).openDemands, other).toEqual([]);
    }
  });

  it("is sometimes forgotten and sometimes chased, across many seeds", () => {
    const outcomes = new Set(SEEDS.map((s) => afterStalling(s, content())));

    expect(outcomes).toContain("forgotten");
    expect(outcomes).toContain("chased");
  });

  it("is resolved the same way every time on the same seed", () => {
    for (const seed of SEEDS.slice(0, 30)) {
      expect(afterStalling(seed, content())).toBe(
        afterStalling(seed, content()),
      );
    }
  });

  it("is resolved no earlier than the month after", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const run = startRun({ seed, content: content() });
      run.choose(answer("stall"));
      const { step, month } = run.choose({ type: "continue" });

      expect(month).toBe(1);
      expect(step.kind).toBe("actions");
    }
  });

  it("depends on the boss", () => {
    const rate = (kind: Kind) => {
      const seeds = SEEDS.filter(
        (s) => bossKind(startRun({ seed: s, content: content() })) === kind,
      );
      const forgotten = seeds.filter(
        (s) => afterStalling(s, content()) === "forgotten",
      );
      return forgotten.length / seeds.length;
    };

    expect(rate("incompetent")).toBeGreaterThan(rate("believer"));
  });

  it("closes when forgotten, and stays closed", () => {
    const seed = SEEDS.find((s) => afterStalling(s, content()) === "forgotten");
    if (seed === undefined) throw new Error("Nothing was ever forgotten.");
    const run = startRun({ seed, content: content() });
    run.choose(answer("stall"));
    run.choose({ type: "continue" });
    let view = run.view();
    while (!(view.step.kind === "notice" && view.step.title === "FORGOTTEN")) {
      view = nextMonth(run);
    }

    expect(view.openDemands).toEqual([]);
  });

  it("closes when the chaser is answered, and not before", () => {
    const seed = SEEDS.find((s) => afterStalling(s, content()) === "chased");
    if (seed === undefined) throw new Error("Nothing was ever chased.");
    const run = startRun({ seed, content: content() });
    run.choose(answer("stall"));
    run.choose({ type: "continue" });
    let view = run.view();
    while (view.step.kind !== "notification") view = nextMonth(run);

    expect(view.openDemands).toHaveLength(1);
    expect(view.step).toMatchObject({ subject: "CHASED" });
    const chased = view.choices[0];
    if (!chased) throw new Error("A chaser with nothing to answer.");
    expect(run.choose(chased).openDemands).toEqual([]);
  });

  it("goes worse when chased than having answered in the first place", () => {
    const opinionAfterAnswering = (seed: number) => {
      const run = startRun({ seed, content: content() });
      run.choose(answer("deliver"));
      return readHiddenTruth(run).bossOpinion;
    };
    const opinionAfterBeingChased = (seed: number) => {
      const run = startRun({ seed, content: content() });
      run.choose(answer("stall"));
      run.choose({ type: "continue" });
      let view = run.view();
      while (view.step.kind !== "notification") view = nextMonth(run);
      run.choose({
        type: "notification",
        notificationId: "tool-chased",
        optionId: "late",
      });
      return readHiddenTruth(run).bossOpinion;
    };

    const chased = SEEDS.filter(
      (s) => afterStalling(s, content()) === "chased",
    ).slice(0, 20);
    expect(chased.length).toBeGreaterThan(0);
    for (const seed of chased) {
      expect(opinionAfterBeingChased(seed)).toBeLessThan(
        opinionAfterAnswering(seed),
      );
    }
  });
});

describe("a Demand's answers", () => {
  it("land differently with different kinds of boss", () => {
    const content = parseContent(demandFixtureRaw());
    const landed = (kind: Kind, optionId: string) => {
      const run = startRun({ seed: seedWithBoss(kind, content), content });
      const { step } = run.choose(answer(optionId));
      return {
        reaction: step.kind === "notice" ? step.reaction : null,
        opinion: readHiddenTruth(run).bossOpinion,
      };
    };

    expect(landed("believer", "deliver").opinion).toBeGreaterThan(
      landed("incompetent", "deliver").opinion,
    );
    expect(landed("incompetent", "fake").opinion).toBeGreaterThan(
      landed("believer", "fake").opinion,
    );
    expect(landed("believer", "deliver").reaction).toBe("WORK-BELIEVER");
    expect(landed("incompetent", "deliver").reaction).toBe("WORK-INCOMPETENT");
  });
});

describe("Demands in content", () => {
  it("refuses a Demand with an answer missing", () => {
    const raw = demandFixtureRaw();
    const [item] = raw.demands.items;
    if (item) item.options = item.options.filter((o) => o.id !== "fake");

    expect(() => parseContent(raw)).toThrow(/needs "fake"/);
  });

  it("refuses a Demand whose stall does not stall", () => {
    const raw = demandFixtureRaw();
    const stall = raw.demands.items[0]?.options.at(-1);
    if (stall) delete (stall as { stalls?: boolean }).stalls;

    expect(() => parseContent(raw)).toThrow(/must stall/);
  });

  it("refuses a chaser that the player might be unable to answer", () => {
    const raw = demandFixtureRaw();
    const [item] = raw.demands.items;
    if (item) {
      item.chased.options = [
        option("late", { cost: "standard", approach: "work" }),
      ];
    }

    expect(() => parseContent(raw)).toThrow(/costs nothing/);
  });

  it("refuses a boss who could never forget, or never chase", () => {
    const raw = demandFixtureRaw();
    raw.demands.odds.believer = { forgets: 0, chases: 0.5 };

    expect(() => parseContent(raw)).toThrow(/forget and to chase/);
  });

  it("refuses odds that add up to more than a certainty", () => {
    const raw = demandFixtureRaw();
    raw.demands.odds.believer = { forgets: 0.7, chases: 0.7 };

    expect(() => parseContent(raw)).toThrow(/more than one/);
  });
});

const BOSS = gameContent.boss.character;

describe("Demands in the game", () => {
  const items = gameContent.demands?.items ?? [];

  it("recur through a run, and at least one comes from above the boss", () => {
    const months = new Set(items.flatMap((d) => d.months ?? []));
    const bossName = gameContent.characters.find((c) => c.id === BOSS)?.name;

    expect(months.size).toBeGreaterThanOrEqual(3);
    expect(items.some((d) => !d.from.includes(bossName ?? ""))).toBe(true);
    expect(items.map((d) => d.from).join()).toMatch(/Chief Financial Officer/);
  });

  it("name a colleague by role when handing off, never by name", () => {
    const names = gameContent.characters.flatMap((c) => c.name.split(" "));
    const roles = gameContent.characters.flatMap((c) => c.called ?? []);
    for (const item of items) {
      const { label } = item.options.find((o) => o.id === "hand-off") ?? {
        label: "",
      };

      expect(
        roles.some((role) => label.includes(role)),
        item.id,
      ).toBe(true);
      for (const name of names) expect(label, item.id).not.toContain(name);
    }
  });

  it("go worse when chased than answering at once, for every Demand and boss", () => {
    const { demands, boss } = gameContent;
    const worth = (kind: Kind, id: string | undefined) =>
      boss.approaches.find((a) => a.id === id)?.shift[kind] ?? 0;
    for (const kind of KINDS) {
      for (const item of items) {
        const stall = item.options.find((o) => o.id === "stall");
        const answers = item.options.filter((o) => o.id !== "stall");
        const direct = Math.max(...answers.map((o) => worth(kind, o.approach)));
        const late = Math.max(
          ...item.chased.options.map((o) => worth(kind, o.approach)),
        );
        const chased =
          worth(kind, stall?.approach) +
          (demands?.chasedPenalty[kind] ?? 0) +
          late;

        expect(chased, `${item.id}, ${kind}`).toBeLessThan(direct);
      }
    }
  });

  it("are sometimes forgotten and sometimes chased in the real game", () => {
    const outcomes = new Set<string>();
    for (const seed of SEEDS.slice(0, 60)) {
      const run = startRun({ seed, content: gameContent });
      let view = run.view();
      while (view.step.kind !== "results") {
        const { step } = view;
        if (step.kind === "notice" && view.openDemands.length === 0) {
          if (/forget|never spoken|not mentioned again/i.test(step.body)) {
            outcomes.add("forgotten");
          }
        }
        if (step.kind === "notification" && step.id.endsWith("-chased")) {
          outcomes.add("chased");
        }
        view = run.choose(pickToward(view));
      }
    }

    expect(outcomes).toEqual(new Set(["forgotten", "chased"]));
  });
});

/** Stalls every Demand, and otherwise answers for nothing. */
function pickToward(view: PlayerView): Choice {
  const { step } = view;
  if (step.kind === "notification") {
    const free = step.options.find((o) => o.costLabel === "Costs nothing");
    const stall = step.options.find((o) => o.id === "stall");
    const chosen = stall ?? free ?? step.options[0];
    if (chosen) {
      return {
        type: "notification",
        notificationId: step.id,
        optionId: chosen.id,
      };
    }
  }
  const next = view.choices[0];
  if (!next) throw new Error(`Stuck at ${step.kind}.`);
  return next;
}
