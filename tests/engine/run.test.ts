import { describe, expect, it } from "vitest";
import {
  parseContent,
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import {
  buzzwordFixtureRaw,
  closingFixture,
  closingFixtureRaw,
  emptyMonth,
  emptyMonthRaw,
  fixtureRaw,
} from "./fixture";

const next: Choice = { type: "continue" };
const pub: Choice = {
  type: "notification",
  notificationId: "invite",
  optionId: "pub",
};
const report: Choice = {
  type: "notification",
  notificationId: "invite",
  optionId: "report",
};

/** Takes the first choice offered until the month's official story. */
function closeMonth(run: Run): PlayerView {
  let view = run.view();
  while (view.step.kind !== "story") {
    const choice = view.choices[0];
    if (!choice) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(choice);
  }
  return view;
}

/** Plays a whole run, varying the path with the seed. */
function playWhole(seed: number, content = closingFixture()) {
  const run = startRun({ seed, content });
  const views = [run.view()];
  let walk = seed;
  for (;;) {
    const { choices } = views.at(-1) as PlayerView;
    if (choices.length === 0) return { run, views };
    walk = (walk * 31 + 7) % 1009;
    views.push(run.choose(choices[walk % choices.length] as Choice));
  }
}

function story(view: PlayerView) {
  if (view.step.kind !== "story") throw new Error(view.step.kind);
  return view.step;
}

describe("a run of months", () => {
  it("offers a way from the official story on to the next month", () => {
    const run = startRun({ seed: 1, content: emptyMonth() });

    expect(closeMonth(run).choices).toEqual([next]);
    expect(run.view().month).toBe(1);

    expect(run.choose(next).month).toBe(2);
  });

  it("restores the full allowance when a new month opens", () => {
    const run = startRun({ seed: 1, content: emptyMonth() });
    expect(closeMonth(run).actions.remaining).toBe(0);

    expect(run.choose(next).actions).toMatchObject({ spent: 0, remaining: 3 });
  });

  it("opens each new month with its Notifications", () => {
    const run = startRun({ seed: 1, content: closingFixture() });
    closeMonth(run);

    expect(run.choose(next).step).toMatchObject({
      kind: "notification",
      id: "invite",
    });
  });

  it("reopens a place that was once a month", () => {
    const run = startRun({ seed: 1, content: closingFixture() });
    run.choose(report);
    run.choose(next);
    run.choose({ type: "action", actionId: "meeting" });
    closeMonth(run);
    run.choose(next);
    run.choose(report);

    const { hotspots } = run.choose(next);

    expect(hotspots.find((h) => h.id === "meeting")?.state).toBe("available");
  });

  it("reports only the month just closed", () => {
    const run = startRun({ seed: 1, content: closingFixture() });
    run.choose(report);
    expect(story(closeMonth(run)).reported).toContain("REPORTED-FILED");

    run.choose(next);
    run.choose(pub);
    const { reported } = story(closeMonth(run));

    expect(reported).toContain("REPORTED-PUB");
    expect(reported).not.toContain("REPORTED-FILED");
  });

  it("carries a Buzzword into a Scene in a later month", () => {
    const raw = buzzwordFixtureRaw();
    raw.balance.monthsPerRun = 4;
    const invite = raw.notifications[0];
    if (invite) invite.months = [1];
    const run = startRun({ seed: 1, content: parseContent(raw) });
    run.choose(pub);
    for (const month of [2, 3, 4]) {
      closeMonth(run);
      expect(run.choose(next).month).toBe(month);
    }

    const { choices, buzzwords } = run.choose({
      type: "action",
      actionId: "meeting",
    });

    expect(buzzwords.map((b) => b.id)).toEqual(["fixture-word"]);
    expect(choices).toContainEqual({
      type: "scene",
      sceneId: "meeting",
      optionId: "use-word",
    });
  });

  it("does not announce a Buzzword the player already knows", () => {
    const run = startRun({ seed: 1, content: closingFixture() });
    expect(run.choose(pub).step).toMatchObject({
      learned: [{ id: "fixture-word" }],
    });
    closeMonth(run);
    run.choose(next);

    const { step, buzzwords } = run.choose(pub);

    expect(step).toMatchObject({ kind: "dialog", learned: [] });
    expect(buzzwords).toHaveLength(1);
  });

  it("takes the length of a run from balance data", () => {
    const raw = emptyMonthRaw();
    raw.balance.monthsPerRun = 5;
    const { views } = playWhole(1, parseContent(raw));

    expect(views.at(-1)?.month).toBe(5);
    expect(views.at(-1)?.totalMonths).toBe(5);
  });

  it("ends after the last month, with no further choices", () => {
    const { run, views } = playWhole(3);

    expect(views.at(-2)?.step.kind).toBe("story");
    expect(views.at(-1)?.choices).toEqual([]);
    expect(() => run.choose(next)).toThrow(/not available/i);
  });

  it("gives the same outcome across the whole run for the same seed", () => {
    const outcome = (seed: number) => {
      const { run, views } = playWhole(seed);
      return { views, truth: readHiddenTruth(run) };
    };

    expect(outcome(11)).toEqual(outcome(11));
  });
});

describe("content restricted to particular months", () => {
  function hasHotspot(view: PlayerView, id: string) {
    return view.hotspots.some((h) => h.id === id);
  }

  it("delivers a Notification only in its months", () => {
    const raw = fixtureRaw();
    const invite = raw.notifications[0];
    if (invite) invite.months = [2];
    const run = startRun({ seed: 1, content: parseContent(raw) });

    expect(run.view().step.kind).toBe("actions");
    closeMonth(run);

    expect(run.choose(next).step.kind).toBe("notification");
  });

  it("offers an action only in its months", () => {
    const raw = emptyMonthRaw();
    const kettle = raw.actions[0] as { months?: number[] };
    kettle.months = [2];
    const run = startRun({ seed: 1, content: parseContent(raw) });

    expect(hasHotspot(run.view(), "kettle")).toBe(false);
    expect(() => run.choose({ type: "action", actionId: "kettle" })).toThrow(
      /not available/i,
    );
    closeMonth(run);

    expect(hasHotspot(run.choose(next), "kettle")).toBe(true);
  });

  it("opens a Scene only in its months", () => {
    const raw = closingFixtureRaw();
    raw.notifications = [];
    const scene = raw.scenes[0];
    if (scene) scene.months = [2];
    const run = startRun({ seed: 1, content: parseContent(raw) });

    expect(hasHotspot(run.view(), "meeting")).toBe(false);
    closeMonth(run);

    expect(hasHotspot(run.choose(next), "meeting")).toBe(true);
  });

  it("lands a Move only in its months", () => {
    const raw = closingFixtureRaw();
    raw.notifications = [];
    raw.moves = [
      { id: "later", from: "Ben", title: "LATER", body: "Later.", months: [2] },
    ];
    const run = startRun({ seed: 1, content: parseContent(raw) });
    const stepsUntilStory = () => {
      const kinds = [run.view().step.kind];
      while (run.view().step.kind !== "story") {
        const choice = run.view().choices[0] as Choice;
        kinds.push(run.choose(choice).step.kind);
      }
      return kinds;
    };

    expect(stepsUntilStory()).not.toContain("move");
    run.choose(next);

    expect(stepsUntilStory()).toContain("move");
  });

  it.each([
    [
      "a Notification",
      (raw: Raw) => {
        const invite = raw.notifications[0];
        if (invite) invite.months = [9];
      },
    ],
    [
      "an action",
      (raw: Raw) => {
        (raw.actions[1] as { months?: number[] }).months = [9];
      },
    ],
    [
      "a Scene",
      (raw: Raw) => {
        const scene = raw.scenes[0];
        if (scene) scene.months = [9];
      },
    ],
    [
      "a Move",
      (raw: Raw) => {
        raw.moves = [
          { id: "m", from: "F", title: "T", body: "B", months: [9] },
        ];
      },
    ],
  ])("rejects %s set in a month the run never reaches", (_name, breakIt) => {
    const raw = closingFixtureRaw();
    breakIt(raw);

    expect(() => parseContent(raw)).toThrow(/month 9/);
  });

  it("rejects an action set in months when its Scene never opens", () => {
    const raw = closingFixtureRaw();
    const scene = raw.scenes[0];
    if (scene) scene.months = [1];
    (raw.actions[0] as { months?: number[] }).months = [2];

    expect(() => parseContent(raw)).toThrow(/never opens/);
  });
});

type Raw = ReturnType<typeof closingFixtureRaw>;

describe("the player view over a whole run", () => {
  it("never leaks the hidden truth at any step of any month", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { run, views } = playWhole(seed);
      const { fact } = readHiddenTruth(run);
      expect(new Set(views.map((v) => v.month)).size).toBeGreaterThan(1);
      for (const view of views) {
        const seen = JSON.stringify(view);
        expect(seen).not.toContain(fact.text);
        expect(seen).not.toContain("powerMap");
      }
    }
  });
});
