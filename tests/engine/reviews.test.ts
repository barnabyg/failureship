import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  resumeRun,
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice } from "../../src/ui/later-month";
import { action, fixtureRaw, room } from "./fixture";

/** A review for one quarter, whose choices go on the record or do not. */
function review(quarter: number) {
  return {
    id: `review-${String(quarter)}`,
    quarter,
    title: `REVIEW-${String(quarter)}`,
    location: "The auditorium",
    narration: [`Quarter ${String(quarter)} is reviewed.`],
    cast: ["ana", "ben", "cal"],
    signs: [{ label: "Whose slide", text: "{holder}'s slide is skipped." }],
    options: [
      {
        id: "steeper",
        label: "Make the arrow steeper",
        results: [{ body: "It is steeper.", sets: ["steeper"] }],
      },
      {
        id: "nod",
        label: "Nod",
        results: [{ body: "You nod." }],
      },
    ],
  };
}

/** A run of so many months, quarters of three, with a review for each quarter. */
function reviewsRaw(monthsPerRun: number) {
  const base = fixtureRaw();
  const quarters = Math.floor(monthsPerRun / 3);
  return {
    ...base,
    balance: { ...base.balance, monthsPerRun, monthsPerQuarter: 3 },
    scenes: Array.from({ length: quarters }, (_, i) => review(i + 1)),
    standing: {
      label: "ON-PAPER",
      title: "How you would do on paper.",
      start: 50,
      reported: { good: 0, fair: 0, bad: 0 },
      finalWarning: 10,
      bands: [
        { from: 0, label: "RED", onPaper: "PAPER-RED" },
        { from: 34, label: "AMBER", onPaper: "PAPER-AMBER" },
      ],
      deeds: [{ flag: "steeper", by: 10 }],
      decides: "DECIDED-BY {who}",
    },
  };
}

/** Plays a whole run, taking `wanted` in each review and the first choice otherwise. */
function playOut(run: Run, wanted = "nod"): PlayerView[] {
  const views = [run.view()];
  for (let view = run.view(); view.choices.length > 0;) {
    const choice: Choice =
      view.step.kind === "scene"
        ? { type: "scene", sceneId: view.step.id, optionId: wanted }
        : (view.choices[0] as Choice);
    view = run.choose(choice);
    views.push(view);
  }
  return views;
}

/** Which Scene opened in which month. */
const scenesOf = (views: readonly PlayerView[]) =>
  views.flatMap((v) =>
    v.step.kind === "scene" ? [{ month: v.month, title: v.step.title }] : [],
  );

describe("Quarterly reviews", () => {
  it("come in months 3, 6 and 9 of a nine-month run, each one its own", () => {
    const content = parseContent(reviewsRaw(9));

    const scenes = scenesOf(playOut(startRun({ seed: 1, content })));

    expect(scenes).toEqual([
      { month: 3, title: "REVIEW-1" },
      { month: 6, title: "REVIEW-2" },
      { month: 9, title: "REVIEW-3" },
    ]);
  });

  it("come every third month of a longer run too", () => {
    const content = parseContent(reviewsRaw(18));

    const scenes = scenesOf(playOut(startRun({ seed: 1, content })));

    expect(scenes.map((s) => s.month)).toEqual([3, 6, 9, 12, 15, 18]);
    expect(new Set(scenes.map((s) => s.title)).size).toBe(6);
  });

  it("open by themselves, take none of the month's actions, and come once", () => {
    const content = parseContent(reviewsRaw(3));
    const run = startRun({ seed: 1, content });
    let view = run.view();
    while (view.step.kind !== "scene") {
      view = run.choose(view.choices[0] as Choice);
    }
    const before = view.actions.remaining;

    view = run.choose({ type: "scene", sceneId: "review-1", optionId: "nod" });

    expect(view.actions.remaining).toBe(before);
    const rest = playOut(run);
    expect(scenesOf(rest)).toEqual([]);
  });

  it("are staged, showing who holds influence but nobody's behaviour", () => {
    const raw = reviewsRaw(3);
    raw.behaviours = [
      {
        id: "sighs",
        text: "{who} sighs.",
        likelihood: { believer: 1, incompetent: 2, practitioner: 3 },
      },
    ];
    const run = startRun({ seed: 1, content: parseContent(raw) });
    let view = run.view();
    while (view.step.kind !== "scene") {
      view = run.choose(view.choices[0] as Choice);
    }

    expect(view.step.behaviours).toEqual([]);
    expect(view.step.signs[0]?.text).toMatch(/^\S.*'s slide is skipped\.$/);
  });

  it("come in their month of the run on whichever floor the player is on", () => {
    const raw = reviewsRaw(9);
    raw.floors.push({
      job: "manager",
      title: "JOB-MANAGER",
      rooms: [room("boardroom", 0)],
    });
    raw.actions.push(action("boardroom"));
    raw.notifications.push({
      id: "manager-own",
      floor: "manager",
      pool: true,
      when: { flag: "never-set" },
      from: "Facilities",
      subject: "NEVER-SEEN",
      body: "Never seen.",
      options: [{ id: "noted", label: "Noted" }],
    });
    const content = parseContent(raw);
    const first = startRun({ seed: 1, content });
    let view = first.view();
    while (view.month < 2 || view.step.kind !== "story") {
      view = first.choose(view.choices[0] as Choice);
    }
    // Promoted at month 2's close: month 3 of the run is month 1 upstairs.
    const saved = JSON.parse(first.save()) as { state: { job: string } };
    saved.state.job = "manager";
    const upstairs = resumeRun({ save: JSON.stringify(saved), content });

    const views = playOut(upstairs);

    expect(scenesOf(views)).toEqual([
      { month: 3, title: "REVIEW-1" },
      { month: 6, title: "REVIEW-2" },
      { month: 9, title: "REVIEW-3" },
    ]);
    expect(views.find((v) => v.step.kind === "scene")?.job.id).toBe("manager");
  });

  it("put what the player chose on the official record", () => {
    const content = parseContent(reviewsRaw(9));

    const nodded = playOut(startRun({ seed: 1, content })).at(-1);
    const steeper = playOut(startRun({ seed: 1, content }), "steeper").at(-1);

    expect(nodded?.standing?.at).toBe(0.5);
    // Ten for each of three reviews.
    expect(steeper?.standing?.at).toBe(0.8);
  });

  it("do not come in a run with no quarters", () => {
    const content = parseContent(fixtureRaw());

    expect(scenesOf(playOut(startRun({ seed: 1, content })))).toEqual([]);
  });
});

const isReview = (view: PlayerView) =>
  view.step.kind === "scene" &&
  gameContent.scenes.some(
    (s) =>
      s.quarter !== undefined &&
      view.step.kind === "scene" &&
      s.id === view.step.id,
  );

/** Plays the real game plainly until its first review opens. */
function toFirstReview(run: Run): PlayerView {
  let view = run.view();
  while (!isReview(view)) view = run.choose(plainChoice(view));
  return view;
}

describe("the real quarterly reviews", () => {
  it("come every third month of the run, each reading differently", () => {
    const reviews = gameContent.scenes.filter((s) => s.quarter !== undefined);
    const run = startRun({ seed: 1, content: gameContent });
    const views = [run.view()];
    while (views.at(-1)?.choices.length) {
      views.push(run.choose(plainChoice(views.at(-1) as PlayerView)));
    }
    const held = views.flatMap((v) =>
      isReview(v) && v.step.kind === "scene"
        ? [{ month: v.month, id: v.step.id }]
        : [],
    );

    expect(gameContent.balance.monthsPerRun).toBe(18);
    expect(held.map((h) => h.month)).toEqual([3, 6, 9, 12, 15, 18]);
    expect(new Set(held.map((h) => h.id)).size).toBe(6);
    const titles = reviews.map((r) => r.title);
    const narrations = reviews.map((r) => r.narration.join(" "));
    expect(new Set(titles).size).toBe(reviews.length);
    expect(new Set(narrations).size).toBe(reviews.length);
  });

  it("move Official standing the same way on deals with different Power Maps", () => {
    const first = gameContent.scenes.find((s) => s.quarter === 1);
    const maps = new Set<string>();
    const moved = new Map<string, Set<number>>();
    for (let seed = 1; seed <= 30; seed++) {
      for (const option of first?.options ?? []) {
        const run = startRun({ seed, content: gameContent });
        const opened = toFirstReview(run);
        if (opened.step.kind !== "scene") throw new Error("No review.");
        // A Final Warning holds the record down, whatever goes on it.
        if (opened.finalWarning) continue;
        maps.add(JSON.stringify(readHiddenTruth(run).powerMap));
        if (!opened.step.options.some((o) => o.id === option.id)) continue;
        const after = run.choose({
          type: "scene",
          sceneId: opened.step.id,
          optionId: option.id,
        });
        const by = (after.standing?.at ?? 0) - (opened.standing?.at ?? 0);
        moved.set(
          option.id,
          (moved.get(option.id) ?? new Set()).add(Math.round(by * 100)),
        );
      }
    }

    expect(maps.size).toBeGreaterThan(5);
    for (const [option, by] of moved) expect([...by], option).toHaveLength(1);
    // The review does move it, one way or the other.
    const all = [...moved.values()].flatMap((by) => [...by]);
    expect(all.some((by) => by > 0)).toBe(true);
    expect(all.some((by) => by < 0)).toBe(true);
  });
});

describe("the data of quarterly reviews", () => {
  const refused = (change: (raw: ReturnType<typeof reviewsRaw>) => void) => {
    const raw = reviewsRaw(9);
    change(raw);
    return () => parseContent(raw);
  };
  const first = (raw: ReturnType<typeof reviewsRaw>) => {
    const scene = raw.scenes[0];
    if (!scene) throw new Error("No review.");
    return scene as ReturnType<typeof review> & Record<string, unknown>;
  };

  it("is accepted with a review for each quarter of the run", () => {
    expect(() => parseContent(reviewsRaw(9))).not.toThrow();
  });

  it("is refused with a quarter of the run that has no review", () => {
    expect(
      refused((raw) => {
        raw.scenes = raw.scenes.filter((s) => s.quarter !== 2);
      }),
    ).toThrow(/Quarter 2 of the run has no review/);
  });

  it("is refused with two reviews for a quarter, or one the run never reaches", () => {
    expect(
      refused((raw) => {
        raw.scenes.push({ ...review(2), id: "another" });
      }),
    ).toThrow(/Quarter 2 has more than one review/);
    expect(
      refused((raw) => {
        raw.scenes.push(review(4));
      }),
    ).toThrow(/Scene "review-4" reviews quarter 4, which a 9-month run/);
  });

  it("is refused with reviews and no quarters in the balance", () => {
    expect(
      refused((raw) => {
        raw.balance = { ...raw.balance, monthsPerQuarter: undefined } as never;
      }),
    ).toThrow(/Scene "review-1" is a review, but .*monthsPerQuarter/);
  });

  it("is refused with a review set by floor, month or pool, or opened another way", () => {
    expect(
      refused((raw) => {
        first(raw).floor = "fixture-job";
      }),
    ).toThrow(/Scene "review-1" is a review, so it cannot have a floor/);
    expect(
      refused((raw) => {
        Object.assign(first(raw), { floor: "fixture-job", months: [1] });
      }),
    ).toThrow(/cannot have months/);
    expect(
      refused((raw) => {
        raw.actions.push({
          ...raw.actions[0],
          id: "go",
          scene: "review-1",
        } as never);
      }),
    ).toThrow(/Scene "review-1" is a review, so no action opens it/);
  });

  it("is refused with a result that reads the hidden truth, or is a big mistake", () => {
    expect(
      refused((raw) => {
        first(raw).options[0]?.results.unshift({
          when: { holderIs: "ana" },
          body: "Right name.",
          sets: ["steeper"],
        } as never);
      }),
    ).toThrow(/Scene "review-1" option "steeper" reads the hidden truth/);
    expect(
      refused((raw) => {
        Object.assign(first(raw).options[1]?.results[0] ?? {}, {
          mistake: "big",
        });
      }),
    ).toThrow(/Scene "review-1" option "nod" is a big mistake/);
  });

  it("is refused with a review that never moves Official standing", () => {
    expect(
      refused((raw) => {
        for (const option of first(raw).options) {
          for (const result of option.results) {
            Object.assign(result, { sets: [] });
          }
        }
      }),
    ).toThrow(
      /Scene "review-1" is a review that never moves Official standing/,
    );
  });
});
