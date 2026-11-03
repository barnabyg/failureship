import { describe, expect, it } from "vitest";
import {
  parseContent,
  resumeRun,
  startRun,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { sceneFixtureRaw } from "./fixture";

/*
 * On the fixture's Org Chart, Ana is at the top and Ben and Cal answer to her.
 * The player starts under Ana, so she is their boss and nobody is above her.
 */
function placesFixtureRaw(cast = ["ana", "ben", "cal"]) {
  const raw = sceneFixtureRaw();
  raw.boss.signs = [
    {
      id: "first-name",
      text: "SIGN-WARM",
      likelihood: { warm: 8, neutral: 1, cold: 0 },
    },
    {
      id: "polite",
      text: "SIGN-NEUTRAL",
      likelihood: { warm: 1, neutral: 8, cold: 1 },
    },
    {
      id: "talks-over",
      text: "SIGN-COLD",
      likelihood: { warm: 0, neutral: 1, cold: 8 },
    },
  ];
  const [scene] = raw.scenes;
  if (scene) {
    scene.cast = cast;
    scene.signs = [];
    scene.options = [
      {
        id: "please",
        label: "Please",
        results: [{ body: "Good.", opinion: 2 }],
      },
      { id: "snub", label: "Snub", results: [{ body: "Bad.", opinion: -2 }] },
      {
        id: "back-boss",
        label: "Back your boss",
        results: [
          { when: { holderIs: "{boss}" }, body: "BACKED-THE-HOLDER" },
          { body: "BACKED-SOMEONE-ELSE" },
        ],
      },
    ];
  }
  return {
    ...raw,
    notifications: [
      {
        id: "memo",
        from: "From: Your boss, {boss}",
        subject: "A memo",
        body: "Noted.",
        options: [{ id: "noted", label: "Noted" }],
      },
    ],
    places: {
      boss: { called: "your boss", title: "{title}, YOUR-BOSS" },
      head: { called: "your boss's boss", title: "{title}, YOUR-BOSS'S-BOSS" },
    },
  };
}

function sceneOf(view: PlayerView) {
  if (view.step.kind !== "scene") throw new Error(view.step.kind);
  return view.step;
}

/** Answers the memo, then opens the month's meeting. */
function openMeeting(run: Run) {
  run.choose({
    type: "notification",
    notificationId: "memo",
    optionId: "noted",
  });
  return sceneOf(run.choose({ type: "action", actionId: "meeting" }));
}

/** Plays on to the start of the next month, taking the last choice offered. */
function toNextMonth(run: Run): void {
  const { month } = run.view();
  let view = run.view();
  while (view.month === month) {
    const choice = view.choices.at(-1);
    if (!choice) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(choice);
  }
}

/** The run as saved, with the player moved to answer to someone else. */
function movePlayer(run: Run, content: Content, to: string): Run {
  const saved = JSON.parse(run.save()) as {
    state: { reportsTo: Record<string, string> };
  };
  saved.state.reportsTo.you = to;
  return resumeRun({ save: JSON.stringify(saved), content });
}

/** Pleases Ana in month 1's meeting, then moves the player under Cal or not. */
function pleasedThenMoved(seed: number, content: Content, to: string | null) {
  const first = startRun({ seed, content });
  openMeeting(first);
  first.choose({ type: "scene", sceneId: "meeting", optionId: "please" });
  toNextMonth(first);
  const run = to === null ? first : movePlayer(first, content, to);
  return { run, step: openMeeting(run) };
}

describe("your boss, read from your place on the Org Chart", () => {
  it("is whoever the player answers to as the run starts", () => {
    const raw = placesFixtureRaw();
    raw.you.reportsTo = "ben";
    const run = startRun({ seed: 1, content: parseContent(raw) });

    expect(run.view().step).toMatchObject({
      kind: "notification",
      from: "From: Your boss, Ben Bird",
    });
    expect(openMeeting(run).cast).toEqual([
      { name: "Ana Abel", title: "Boss, YOUR-BOSS'S-BOSS" },
      { name: "Ben Bird", title: "Analyst, YOUR-BOSS" },
      { name: "Cal Cope", title: "Clerk" },
    ]);
  });

  it("changes when the player moves, and the boss's signs and treatment follow", () => {
    const content = parseContent(placesFixtureRaw());
    const treatments = (to: string | null) =>
      Array.from(
        { length: 300 },
        (_, i) => pleasedThenMoved(i + 1, content, to).step.treatment,
      );
    const count = (signs: (string | null)[], sign: string) =>
      signs.filter((s) => s === sign).length;

    // Ana was pleased, and stays warm. Cal, the new boss, has heard nothing yet.
    const stayed = treatments(null);
    const moved = treatments("cal");

    expect(count(stayed, "SIGN-WARM")).toBeGreaterThan(200);
    expect(count(moved, "SIGN-NEUTRAL")).toBeGreaterThan(200);
    expect(count(moved, "SIGN-WARM")).toBeLessThan(50);
  });

  it("moves the new boss's belief, words and title, and leaves the old one's alone", () => {
    const content = parseContent(placesFixtureRaw());
    const { run, step } = pleasedThenMoved(1, content, "cal");

    expect(step.cast).toEqual([
      { name: "Ana Abel", title: "Boss, YOUR-BOSS'S-BOSS" },
      { name: "Ben Bird", title: "Analyst" },
      { name: "Cal Cope", title: "Clerk, YOUR-BOSS" },
    ]);
    run.choose({ type: "scene", sceneId: "meeting", optionId: "snub" });

    const truth = readHiddenTruth(run);
    expect(truth.bossBelief).toBe(-2);
    expect(truth.beliefs.cal).toBe(-2);
    expect(truth.beliefs.ana).toBe(2);
    expect(truth.headBelief).toBe(2);
  });

  it("shows no treatment when the new boss is not in the room, even if the old one is", () => {
    const content = parseContent(placesFixtureRaw(["ana", "ben"]));

    const treated = Array.from(
      { length: 50 },
      (_, i) => pleasedThenMoved(i + 1, content, "cal").step.treatment,
    );

    expect(treated.every((t) => t === null)).toBe(true);
  });

  it("writes in whoever holds the place where data names it", () => {
    const content = parseContent(placesFixtureRaw());
    const backed = (to: string | null) =>
      Array.from({ length: 100 }, (_, i) => {
        const { run } = pleasedThenMoved(i + 1, content, to);
        const holder = readHiddenTruth(run).powerMap.order[0];
        const view = run.choose({
          type: "scene",
          sceneId: "meeting",
          optionId: "back-boss",
        });
        if (view.step.kind !== "notice") throw new Error(view.step.kind);
        return { holder, body: view.step.body };
      });

    for (const [to, boss] of [
      [null, "ana"],
      ["cal", "cal"],
    ] as const) {
      for (const { holder, body } of backed(to)) {
        expect(body).toBe(
          holder === boss ? "BACKED-THE-HOLDER" : "BACKED-SOMEONE-ELSE",
        );
      }
    }
    const moved = startRun({ seed: 1, content });
    toNextMonth(moved);

    expect(movePlayer(moved, content, "cal").view().step).toMatchObject({
      from: "From: Your boss, Cal Cope",
    });
  });
});
