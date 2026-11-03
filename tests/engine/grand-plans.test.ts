import { describe, expect, it } from "vitest";
import {
  ContentError,
  parseContent,
  resumeRun,
  startRun,
  type Choice,
  type Content,
  type Kind,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { fixtureRaw, floorOwn } from "./fixture";

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

const mistakes = {
  finalWarning: { title: "WARNED", body: "One more." },
  fired: { title: "FIRED", body: "That was one more." },
  firedOutright: { title: "FIRED-OUTRIGHT", body: "That was all it took." },
  results: { title: "ENDED", intro: "It ended." },
  firedIn: "FIRED-IN {month}",
  finished: "LASTED",
};

const certain = { believer: 1, incompetent: 1, practitioner: 1 };
const never = { believer: 0, incompetent: 0, practitioner: 0 };
const evenly = { warm: 0, neutral: 0, cold: 0 };

const reaction = (word: string) => ({
  believer: `${word}-BELIEVER`,
  incompetent: `${word}-INCOMPETENT`,
  practitioner: `${word}-PRACTITIONER`,
});

function plan(id: string, heardIn: string, blame = certain) {
  return {
    id,
    floor: "fixture-job",
    title: `${id.toUpperCase()}-TITLE`,
    what: `${id.toUpperCase()}-WHAT`,
    lasts: 2,
    heardIn: [heardIn],
    ways: [
      {
        id: "really",
        how: "reality",
        when: { did: "really-done" },
        belief: { believer: 3, incompetent: 0, practitioner: 1 },
        reaction: reaction("REALLY"),
        sets: ["completed-plan"],
        done: { title: "DONE-REALLY", body: "It is really done." },
      },
      {
        id: "on-paper",
        how: "appearance",
        when: { did: "looks-done" },
        belief: { believer: -2, incompetent: 3, practitioner: 1 },
        reaction: reaction("ON-PAPER"),
        sets: ["completed-plan", "hollow-plan"],
        done: { title: "DONE-ON-PAPER", body: "It looks done." },
      },
    ],
    failed: {
      blame: { chance: blame, mood: evenly },
      onPlayer: {
        id: `${id}-blamed-you`,
        as: "notice",
        title: "BLAMED-YOU",
        body: "It was you.",
        mistake: "big",
      },
      onSomeoneElse: {
        id: `${id}-blamed-them`,
        as: "notice",
        title: "BLAMED-THEM",
        body: "It was them.",
      },
    },
    results: {
      reality: "FATE-REALITY",
      appearance: "FATE-APPEARANCE",
      failed: "FATE-FAILED",
      running: "FATE-RUNNING",
    },
  };
}

/**
 * Four months on the fixture's floor. In month 1 the boss's Plan is told, and
 * in month 2 it can be done for real, on paper, or not at all. It is due by
 * the end of month 2.
 */
function raw(blame = certain) {
  const base = fixtureRaw();
  base.balance.monthsPerRun = 4;
  return {
    ...base,
    mistakes,
    notifications: [
      {
        id: "plan-told",
        floor: "fixture-job",
        months: [1],
        from: "Your boss",
        subject: "My Grand Plan",
        body: "Here it is.",
        options: [{ id: "noted", label: "Noted" }],
      },
      {
        id: "plan-work",
        floor: "fixture-job",
        months: [2],
        from: "Your boss",
        subject: "The Grand Plan",
        body: "Well?",
        options: [
          { id: "really", label: "Do it", sets: ["really-done"] },
          { id: "on-paper", label: "Say it is done", sets: ["looks-done"] },
          { id: "leave", label: "Leave it" },
        ],
      },
      {
        id: "next-told",
        floor: "fixture-job",
        when: { planRunning: "next-plan" },
        from: "Your new boss",
        subject: "My own Grand Plan",
        body: "Here is mine.",
        options: [{ id: "noted-next", label: "Noted" }],
      },
      ...floorOwn(),
    ] as ReturnType<typeof fixtureRaw>["notifications"],
    risks: [
      {
        id: "hollow",
        addedBy: "hollow-plan",
        after: { min: 5, max: 5 },
        note: "HOLLOW-NOTE",
        route: { character: "ben", chance: certain, motive: "HOLLOW-MOTIVE" },
        traced: { did: "hollow-plan" },
        onPlayer: {
          id: "hollow-out",
          as: "notice",
          title: "HOLLOW-OUT",
          body: "It was empty.",
        },
        landedOnYou: "LANDED-ON-YOU",
        landedElsewhere: "LANDED-ELSEWHERE",
        neverCameOut: "NEVER-CAME-OUT",
      },
    ],
    standing: {
      label: "ON-PAPER",
      title: "How you would do on paper.",
      start: 50,
      reported: { good: 0, fair: 0, bad: 0 },
      finalWarning: 10,
      bands: [
        { from: 0, label: "RED", onPaper: "PAPER-RED" },
        { from: 34, label: "AMBER", onPaper: "PAPER-AMBER" },
        { from: 67, label: "GREEN", onPaper: "PAPER-GREEN" },
      ],
      deeds: [{ flag: "completed-plan", by: 20 }],
      decides: "DECIDED-BY {who}",
    },
    grandPlans: {
      statuses: {
        running: "RUNNING-TO-{month}",
        completed: "COMPLETED",
        failed: "FAILED",
      },
      plans: [
        plan("big-plan", "plan-told", blame),
        plan("next-plan", "next-told"),
      ],
    },
  };
}

/** Plays on, answering with these where they are offered, and otherwise the first choice. */
function play(run: Run, ...answers: string[]): PlayerView[] {
  let view = run.view();
  const views = [view];
  while (view.choices.length > 0) {
    const { step } = view;
    const wanted =
      step.kind === "notification"
        ? step.options.find((o) => answers.includes(o.id))
        : undefined;
    const choice: Choice =
      step.kind === "notification" && wanted
        ? { type: "notification", notificationId: step.id, optionId: wanted.id }
        : (view.choices[0] as Choice);
    view = run.choose(choice);
    views.push(view);
  }
  return views;
}

const answer = (notificationId: string, optionId: string): Choice => ({
  type: "notification",
  notificationId,
  optionId,
});

const titled = (views: PlayerView[], title: string) =>
  views.find((v) => v.step.kind === "notice" && v.step.title === title);

/** The boss, whom the fixture makes Ana, dealt as this kind on some seed. */
function seedWhereBossIs(kind: Kind, content: Content): number {
  const seed = SEEDS.find(
    (s) =>
      readHiddenTruth(startRun({ seed: s, content })).characters.find(
        (c) => c.id === "ana",
      )?.kind === kind,
  );
  if (seed === undefined) throw new Error(`No seed deals a ${kind} boss.`);
  return seed;
}

/** Hears of the Plan in month 1, and answers month 2's Notification with this. */
function completed(seed: number, content: Content, optionId: string) {
  const run = startRun({ seed, content });
  run.choose(answer("plan-told", "noted"));
  let view = run.view();
  while (view.step.kind !== "notification" || view.step.id !== "plan-work") {
    view = run.choose(view.choices[0] as Choice);
  }
  const before = readHiddenTruth(run).bossBelief;
  const standingBefore = view.standing?.at;
  view = run.choose(answer("plan-work", optionId));
  // What the player is told of the Plan follows what the choice itself says.
  while (view.step.kind !== "notice" || !view.step.title.startsWith("DONE")) {
    view = run.choose(view.choices[0] as Choice);
  }
  return {
    run,
    view,
    shift: readHiddenTruth(run).bossBelief - before,
    standingShift: (view.standing?.at ?? 0) - (standingBefore ?? 0),
  };
}

/** The run as saved, with the player moved to answer to someone else. */
function movePlayer(run: Run, content: Content, to: string): Run {
  const saved = JSON.parse(run.save()) as {
    state: { reportsTo: Record<string, string> };
  };
  saved.state.reportsTo.you = to;
  return resumeRun({ save: JSON.stringify(saved), content });
}

describe("the boss's Grand Plan", () => {
  const content = parseContent(raw());

  it("is not in view until the player hears of it, and then says when it is due", () => {
    const run = startRun({ seed: 1, content });
    expect(run.view().grandPlan).toBeNull();

    const view = run.choose(answer("plan-told", "noted"));

    expect(view.grandPlan).toEqual({
      title: "BIG-PLAN-TITLE",
      what: "BIG-PLAN-WHAT",
      status: "RUNNING-TO-2",
    });
  });

  it("pleases one kind of boss and not another with the same completion", () => {
    const shift = (kind: Kind) =>
      completed(seedWhereBossIs(kind, content), content, "on-paper").shift;

    expect(shift("incompetent")).toBe(3);
    expect(shift("believer")).toBe(-2);
    expect(shift("practitioner")).toBe(1);
  });

  it("shows how the boss took it only through signs written for their kind", () => {
    for (const kind of ["believer", "incompetent"] as const) {
      const { view } = completed(
        seedWhereBossIs(kind, content),
        content,
        "really",
      );

      expect(view.step).toMatchObject({
        kind: "notice",
        title: "DONE-REALLY",
        reaction: `REALLY-${kind.toUpperCase()}`,
      });
      expect(view.grandPlan?.status).toBe("COMPLETED");
    }
  });

  it("goes on the official record the same way, whatever the boss's kind", () => {
    const shifts = (["believer", "incompetent", "practitioner"] as const).map(
      (kind) =>
        completed(seedWhereBossIs(kind, content), content, "on-paper")
          .standingShift,
    );

    for (const shift of shifts) expect(shift).toBeCloseTo(0.2);
  });

  it("adds a hidden risk when completed in appearance, and none when completed in reality", () => {
    const onPaper = completed(1, content, "on-paper").run;
    const really = completed(1, content, "really").run;

    expect(readHiddenTruth(onPaper).risks.map((r) => r.id)).toEqual(["hollow"]);
    expect(readHiddenTruth(really).risks).toEqual([]);
  });

  it("is completed only once", () => {
    const { run } = completed(1, content, "really");
    const views = play(run, "on-paper");

    expect(titled(views, "DONE-ON-PAPER")).toBeUndefined();
    expect(readHiddenTruth(run).risks).toEqual([]);
  });

  it("fails if it is not done when due, and the boss can blame the player for a big mistake", () => {
    const views = play(startRun({ seed: 1, content }), "noted", "leave");

    expect(titled(views, "BLAMED-YOU")?.month).toBe(3);
    expect(views.at(-1)?.finalWarning).toBe(true);
    expect(views.find((v) => v.month === 3)?.grandPlan?.status).toBe("FAILED");
  });

  it("can be blamed on someone else instead", () => {
    const blameless = parseContent(raw(never));

    const views = play(startRun({ seed: 1, content: blameless }), "leave");

    expect(titled(views, "BLAMED-YOU")).toBeUndefined();
    expect(titled(views, "BLAMED-THEM")?.month).toBe(3);
    expect(views.at(-1)?.finalWarning).toBe(false);
  });

  it("never fails once completed", () => {
    const views = play(startRun({ seed: 1, content }), "noted", "really");

    expect(titled(views, "BLAMED-YOU")).toBeUndefined();
    expect(titled(views, "BLAMED-THEM")).toBeUndefined();
  });

  it("is said on the results screen, with how it ended", () => {
    const fate = (...answers: string[]) => {
      const { step } = play(startRun({ seed: 1, content }), ...answers).at(
        -1,
      ) as PlayerView;
      if (step.kind !== "results") throw new Error(step.kind);
      return step.grandPlans;
    };

    expect(fate("noted", "on-paper")).toEqual([
      {
        month: 1,
        name: "Ana Abel",
        title: "Boss",
        plan: "BIG-PLAN-TITLE",
        fate: "FATE-APPEARANCE",
      },
    ]);
    expect(fate("noted", "really")[0]?.fate).toBe("FATE-REALITY");
    expect(fate("noted", "leave")[0]?.fate).toBe("FATE-FAILED");
  });

  it("belongs to whoever is the player's boss now, so a new boss brings a new one", () => {
    const first = startRun({ seed: 1, content });
    first.choose(answer("plan-told", "noted"));
    // Ben answers to Ana, so moving under him makes him the boss.
    const run = movePlayer(first, content, "ben");
    expect(run.view().grandPlan).toBeNull();

    const views = play(run, "noted-next", "leave");

    const told = views.find(
      (v) => v.step.kind === "notification" && v.step.id === "next-told",
    );
    expect(told?.month).toBe(2);
    const heard = views.find((v) => v.grandPlan !== null);
    expect(heard?.grandPlan?.title).toBe("NEXT-PLAN-TITLE");
    expect(heard?.grandPlan?.status).toBe("RUNNING-TO-3");
    // Ana's Plan went with her, and nobody blames the player for it.
    expect(
      views.filter((v) => v.month === 3).map((v) => v.step),
    ).not.toContainEqual(expect.objectContaining({ title: "BLAMED-YOU" }));
    // The new boss's own Plan is due at the end of month 3, and fails as month 4 opens.
    expect(titled(views, "BLAMED-YOU")?.month).toBe(4);
  });
});

describe("Grand Plans in the data", () => {
  const refused = (change: (r: ReturnType<typeof raw>) => void) => {
    const written = raw();
    change(written);
    return () => parseContent(written);
  };
  const firstPlan = (r: ReturnType<typeof raw>) => {
    const [first] = r.grandPlans.plans;
    if (!first) throw new Error("No Plan.");
    return first;
  };
  const way = (r: ReturnType<typeof raw>, i: number) => {
    const found = firstPlan(r).ways[i];
    if (!found) throw new Error("No way.");
    return found;
  };

  it("refuse a Plan completed in appearance that adds no hidden risk", () => {
    expect(
      refused((r) => {
        way(r, 1).sets = ["completed-plan"];
      }),
    ).toThrow(/appearance.*hidden risk/);
  });

  it("refuse a Plan completed in reality that adds one", () => {
    expect(
      refused((r) => {
        way(r, 0).sets = ["completed-plan", "hollow-plan"];
      }),
    ).toThrow(/reality.*hidden risk/);
  });

  it("refuse a Plan that cannot be completed both ways", () => {
    expect(
      refused((r) => {
        way(r, 1).how = "reality";
        way(r, 1).sets = ["completed-plan"];
      }),
    ).toThrow(/in appearance/);
  });

  it("refuse a way of completing it that reads the hidden truth", () => {
    expect(
      refused((r) => {
        way(r, 0).when = { bossIs: "believer" } as unknown as {
          did: string;
        };
      }),
    ).toThrow(/hidden truth/);
  });

  it("refuse a way that every kind of boss takes alike", () => {
    expect(
      refused((r) => {
        way(r, 0).belief = { believer: 1, incompetent: 1, practitioner: 1 };
      }),
    ).toThrow(/alike/);
  });

  it("refuse a reaction that names a kind", () => {
    expect(
      refused((r) => {
        way(r, 0).reaction.believer = "Very KIND-BELIEVER of you.";
      }),
    ).toThrow(/names a kind/);
  });

  it("refuse a Plan heard of somewhere that does not exist", () => {
    expect(
      refused((r) => {
        firstPlan(r).heardIn = ["nowhere"];
      }),
    ).toThrow(/nowhere/);
  });

  it("refuse a Plan that lasts less than several months, or longer than the run", () => {
    expect(
      refused((r) => {
        firstPlan(r).lasts = 1;
      }),
    ).toThrow(/lasts/);
    expect(
      refused((r) => {
        firstPlan(r).lasts = 5;
      }),
    ).toThrow(/lasts/);
  });

  it("refuse a condition that names an unknown Plan", () => {
    expect(
      refused((r) => {
        const told = r.notifications.find((n) => n.id === "next-told");
        if (told) told.when = { planRunning: "no-such-plan" };
      }),
    ).toThrow(ContentError);
  });
});
