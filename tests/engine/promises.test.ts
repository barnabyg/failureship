import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  startRun,
  type Choice,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice } from "../../src/ui/later-month";
import { emptyMonthRaw, floorOwn } from "./fixture";

const SEEDS = Array.from({ length: 400 }, (_, i) => i);
const line = (who: string) => `{who} ${who} {what}`;
const perKind = (written: string) => ({
  believer: [written],
  incompetent: [written],
  practitioner: [written],
});

function raw(chance = 1) {
  const base = emptyMonthRaw();
  const due = {
    from: "Them",
    subject: "DUE",
    body: "It has fallen due.",
    options: [
      { id: "keep-it", label: "Keep it", settles: "kept" },
      { id: "break-it", label: "Break it", settles: "broken" },
    ],
  };
  const item = (id: string, to: string) => ({
    id,
    to,
    title: id,
    what: `WHAT-${id}`,
    after: { min: 1, max: 1 },
    due: {
      ...due,
      options: due.options.map((o) => ({ ...o, id: `${o.id}-${id}` })),
    },
  });
  return {
    ...base,
    balance: { ...base.balance, monthsPerRun: 4 },
    reputation: {
      travel: {
        hopsPerMonth: 1,
        maxHops: 2,
        passOnChance: 1,
        shift: { good: 1, bad: -1 },
      },
      mood: { warmAt: 50, coldAt: -50 },
      signs: [
        {
          id: "s",
          text: "{who} is there.",
          likelihood: { warm: 1, neutral: 2, cold: 3 },
        },
      ],
      believes: { warm: "W", neutral: "N", cold: "C" },
      how: { direct: "There.", heardFrom: "From {who}." },
    },
    promises: {
      belief: {
        chance: { believer: chance, incompetent: chance, practitioner: chance },
        mood: { warm: 0, neutral: 0, cold: 0 },
        perBroken: 0.5,
        perKept: 0.2,
      },
      replies: {
        believed: perKind(line("BELIEVES")),
        doubted: perKind(line("DOUBTS")),
        letDown: [line("LET-DOWN")],
        heard: ["{who} HEARD {victim} {what}"],
      },
      broken: { about: "broke", text: "BROKE {victim} {what}", perTie: 1 },
      kept: { about: "kept", text: "KEPT {victim} {what}" },
      statuses: {
        open: "OPEN",
        kept: "KEPT",
        broken: "BROKEN",
        refused: "REFUSED",
        lapsed: "LAPSED",
      },
      items: [
        item("first", "ben"),
        item("second", "ben"),
        item("third", "cal"),
      ],
    },
    notifications: [
      {
        id: "offers",
        from: "Someone",
        subject: "Offers",
        body: "Say something.",
        floor: "fixture-job",
        months: [1],
        options: [
          { id: "nothing", label: "Say nothing" },
          { id: "offer-first", label: "Offer", promise: "first" },
          { id: "offer-third", label: "Offer", promise: "third" },
        ],
      },
      {
        id: "more-offers",
        from: "Someone",
        subject: "More offers",
        body: "Say something else.",
        floor: "fixture-job",
        months: [3],
        options: [
          { id: "nothing-more", label: "Say nothing" },
          { id: "offer-second", label: "Offer", promise: "second" },
        ],
      },
      ...floorOwn(2),
    ],
  };
}

const answer = (notificationId: string, optionId: string): Choice => ({
  type: "notification",
  notificationId,
  optionId,
});

/** Plays on, spending the time at the kettle, until the wanted month opens. */
function reachMonth(run: Run, month: number) {
  let view = run.view();
  while (view.month < month) {
    const next: Choice | undefined =
      view.step.kind === "notification"
        ? {
            type: "notification",
            notificationId: view.step.id,
            optionId: view.step.options[0]?.id ?? "",
          }
        : view.choices[0];
    if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(next);
  }
  return view;
}

const totalBelief = (run: Run) =>
  Object.values(readHiddenTruth(run).beliefs).reduce((a, b) => a + b, 0);

/** Offers one Promise in month 1, then breaks it as month 2 opens. */
function breakOne(seed: number, option: string, due: string, breaker: string) {
  const run = startRun({ seed, content: parseContent(raw()) });
  run.choose(answer("offers", option));
  reachMonthBefore(run, due);
  const before = totalBelief(run);
  run.choose(answer(due, breaker));
  return { run, cost: before - totalBelief(run) };
}

function reachMonthBefore(run: Run, due: string) {
  let view = run.view();
  while (!(view.step.kind === "notification" && view.step.id === due)) {
    const next = view.choices[0];
    if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(next);
  }
}

const ties = (run: Run, id: string) =>
  readHiddenTruth(run).powerMap.influence.filter(
    (t) => t.who === id || t.over === id,
  ).length;

describe("a Promise", () => {
  it("can be made whether or not it can be delivered, and shows at no cost", () => {
    const run = startRun({ seed: 1, content: parseContent(raw()) });
    const spent = run.view().actions.spent;

    const view = run.choose(answer("offers", "offer-first"));

    expect(view.actions.spent).toBe(spent);
    expect(view.promises).toEqual([
      { month: 1, to: "Ben Bird", what: "WHAT-first", status: "OPEN" },
    ]);
    expect(view.step).toMatchObject({ kind: "notice", title: "first" });
  });

  it("can be declined, and the reason shows through what they say", () => {
    const run = startRun({ seed: 1, content: parseContent(raw(0)) });

    const view = run.choose(answer("offers", "offer-first"));

    expect(view.promises[0]?.status).toBe("REFUSED");
    expect(JSON.stringify(view.step)).toContain("DOUBTS");
  });

  it("is given once in a run", () => {
    const run = startRun({ seed: 1, content: parseContent(raw(0)) });

    run.choose(answer("offers", "offer-first"));

    expect(() => run.choose(answer("offers", "offer-first"))).toThrow();
  });

  it("falls due, and can be kept or broken, and they remember which", () => {
    for (const [optionId, status, about] of [
      ["keep-it-first", "KEPT", "kept"],
      ["break-it-first", "BROKEN", "broke"],
    ] as const) {
      const run = startRun({ seed: 2, content: parseContent(raw()) });
      run.choose(answer("offers", "offer-first"));
      reachMonthBefore(run, "first-due");

      const view = run.choose(answer("first-due", optionId));

      expect(view.promises[0]?.status).toBe(status);
      expect(
        readHiddenTruth(run).memories.some(
          (m) => m.character === "ben" && m.about === about,
        ),
      ).toBe(true);
    }
  });

  it("costs more to break the better connected its victim is", () => {
    const costOn = (seed: number) =>
      breakOne(seed, "offer-first", "first-due", "break-it-first");
    const ofTies = (wanted: (n: number) => boolean) =>
      SEEDS.map(costOn).find(({ run }) => wanted(ties(run, "ben")));
    const well = ofTies((n) => n >= 2);
    const poorly = ofTies((n) => n === 1);

    expect(well).toBeDefined();
    expect(poorly).toBeDefined();
    expect(well?.cost).toBeGreaterThan(poorly?.cost ?? Infinity);
  });

  it("travels through the Power Map when broken, and the results say who heard", () => {
    const { run } = breakOne(2, "offer-first", "first-due", "break-it-first");
    const heard = readHiddenTruth(run)
      .memories.filter((m) => m.about === "broke")
      .map((m) => m.character);

    expect(heard).toContain("ben");
    expect(heard.length).toBe(1 + ties(run, "ben"));

    reachMonth(run, 4);
    let view = run.view();
    while (view.choices.length > 0) {
      const next = view.choices[0];
      if (!next) break;
      view = run.choose(next);
    }
    if (view.step.kind !== "results") throw new Error("No results.");
    const row = view.step.promises.find((p) => p.what === "WHAT-first");

    expect(row?.status).toBe("BROKEN");
    expect(row?.heardBy.length).toBeGreaterThan(0);
  });

  it("is less likely to be believed by someone who remembers a broken one", () => {
    const believedSecond = (breakFirst: boolean) =>
      SEEDS.filter((seed) => {
        const run = startRun({
          seed,
          content: parseContent(raw(0.7)),
        });
        run.choose(answer("offers", "offer-first"));
        if (run.view().promises[0]?.status !== "OPEN") return false;
        reachMonthBefore(run, "first-due");
        run.choose(
          answer("first-due", breakFirst ? "break-it-first" : "keep-it-first"),
        );
        reachMonthBefore(run, "more-offers");
        const view = run.choose(answer("more-offers", "offer-second"));
        return view.promises[1]?.status === "OPEN";
      }).length;

    expect(believedSecond(true)).toBeLessThan(believedSecond(false));
  });

  it("is refused in their own words by someone let down, or told of it", () => {
    const content = parseContent(raw(0.4));
    const said = SEEDS.flatMap((seed) => {
      const run = startRun({ seed, content });
      run.choose(answer("offers", "offer-first"));
      if (run.view().promises[0]?.status !== "OPEN") return [];
      reachMonthBefore(run, "first-due");
      run.choose(answer("first-due", "break-it-first"));
      reachMonthBefore(run, "more-offers");
      return [
        JSON.stringify(run.choose(answer("more-offers", "offer-second")).step),
      ];
    });

    expect(said.some((step) => step.includes("LET-DOWN"))).toBe(true);
  });

  it("is refused when the Promise names nobody who exists", () => {
    const broken = raw();
    const [first] = broken.promises.items;
    if (first) first.to = "nobody";

    expect(() => parseContent(broken)).toThrow(/unknown "nobody"/);
  });

  it("is refused if there is no free way to break it", () => {
    const broken = raw();
    const [first] = broken.promises.items;
    if (first) {
      first.due.options = first.due.options.filter((o) => o.settles === "kept");
    }

    expect(() => parseContent(broken)).toThrow(/free way to break/);
  });
});

describe("the real Promises", () => {
  it("can be made in more than one place in a run", () => {
    const places = [
      ...gameContent.notifications.flatMap((n) => n.options),
      ...gameContent.scenes.flatMap((s) => s.options),
    ].filter((o) => o.promise !== undefined);

    expect(places.length).toBeGreaterThan(1);
  });

  // tests/e2e/promise.spec.ts plays this: the Senior Analyst believes it in month 3,
  // and by month 6 your boss has heard, and turns the next one down.
  it("keeps the deal that the browser test uses", () => {
    const seed = 24;
    const run = startRun({ seed, content: gameContent });
    let view = run.view();
    while (view.month < 3) view = run.choose(plainChoice(view));
    while (
      view.step.kind !== "notification" ||
      view.step.id !== "laptops-request"
    ) {
      view = run.choose(plainChoice(view));
    }
    view = run.choose(answer("laptops-request", "promise-laptops-analyst"));

    expect(view.promises[0]?.status).toBe("Believed, and waiting");
    while (
      view.step.kind !== "notification" ||
      view.step.id !== "laptops-for-the-analyst-due"
    ) {
      view = run.choose(plainChoice(view));
    }
    view = run.choose(answer(view.step.id, "next-quarter"));
    while (view.month < 6) view = run.choose(plainChoice(view));
    while (view.step.kind !== "actions") view = run.choose(plainChoice(view));
    run.choose({ type: "action", actionId: "meeting-metric" });
    view = run.choose({
      type: "scene",
      sceneId: "metric-review",
      optionId: "promise-laptops",
    });

    expect(view.promises[1]?.status).toBe("They did not believe you");
    expect(JSON.stringify(view.step)).toMatch(/new laptops for their team/);
  });
});
