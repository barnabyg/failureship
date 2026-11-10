import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  resumeRun,
  startRun,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { action, room, sceneFixtureRaw, withRoom, floorOwn } from "./fixture";
import { castOf, regardIn, treatmentOf } from "./scene-view";

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
        options: [
          { id: "noted", label: "Noted" },
          { id: "promise", label: "Promise", promise: "to-the-boss" },
        ],
      },
      ...floorOwn(),
    ],
    places: {
      boss: { called: "your boss", title: "{title}, YOUR-BOSS" },
      head: { called: "your boss's boss", title: "{title}, YOUR-BOSS'S-BOSS" },
    },
    reputation: {
      travel: {
        hopsPerMonth: 1,
        maxHops: 0,
        passOnChance: 0,
        shift: { good: 1, bad: -1 },
      },
      mood: { warmAt: 1, coldAt: -1 },
      signs: [
        {
          id: "there",
          text: "REGARD {who}",
          likelihood: { warm: 1, neutral: 2, cold: 3 },
        },
      ],
      believes: { warm: "W", neutral: "N", cold: "C" },
      how: { direct: "There.", heardFrom: "From {who}." },
    },
    promises: promisesRaw(),
  };
}

/** One Promise, to your boss, always believed, and not due before the run ends. */
function promisesRaw() {
  const always = { believer: 1, incompetent: 1, practitioner: 1 };
  const said = {
    believer: ["Yes."],
    incompetent: ["Yes."],
    practitioner: ["Yes."],
  };
  return {
    belief: {
      chance: always,
      mood: { warm: 0, neutral: 0, cold: 0 },
      perBroken: 0,
      perKept: 0,
    },
    replies: {
      believed: said,
      doubted: said,
      letDown: ["No."],
      heard: ["No."],
    },
    broken: { about: "broke", text: "BROKE {victim} {what}", perTie: 0 },
    kept: { about: "kept", text: "KEPT {victim} {what}" },
    statuses: {
      open: "OPEN",
      kept: "KEPT",
      broken: "BROKEN",
      refused: "REFUSED",
      lapsed: "LAPSED",
    },
    items: [
      {
        id: "to-the-boss",
        to: "{boss}",
        title: "A promise",
        what: "something",
        after: { min: 9, max: 9 },
        due: {
          from: "From: Your boss, {boss}",
          subject: "DUE",
          body: "It has fallen due.",
          options: [{ id: "break-it", label: "Break it", settles: "broken" }],
        },
      },
    ],
  };
}

/**
 * Ben is the player's boss and Ana his boss, as the run starts. Cal answers to
 * Ben, so moving the player under Cal moves Ben up to be the boss's boss.
 */
function upFixtureRaw() {
  const raw = placesFixtureRaw();
  raw.you.reportsTo = "ben";
  const cal = raw.characters.find((c) => c.id === "cal");
  if (cal) cal.reportsTo = "ben";
  return {
    ...raw,
    overHead: gameContent.overHead,
    // First, so that the last choice, which these tests take, never goes upstairs.
    actions: [
      { ...action("upstairs"), result: undefined, overHead: true },
      ...raw.actions,
    ],
    floors: withRoom(raw.floors, room("upstairs", 10)),
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
    expect(castOf(openMeeting(run))).toEqual([
      { name: "Ana Abel", title: "Boss, YOUR-BOSS'S-BOSS" },
      { name: "Ben Bird", title: "Analyst, YOUR-BOSS" },
      { name: "Cal Cope", title: "Clerk" },
    ]);
  });

  it("puts whoever is in a place in a cast that names it, once each", () => {
    const raw = placesFixtureRaw(["{boss}", "{head}", "ben", "cal"]);
    raw.you.reportsTo = "ben";
    const run = startRun({ seed: 1, content: parseContent(raw) });

    expect(castOf(openMeeting(run))).toEqual([
      { name: "Ana Abel", title: "Boss, YOUR-BOSS'S-BOSS" },
      { name: "Ben Bird", title: "Analyst, YOUR-BOSS" },
      { name: "Cal Cope", title: "Clerk" },
    ]);
  });

  it("changes when the player moves, and the boss's signs and treatment follow", () => {
    const content = parseContent(placesFixtureRaw());
    const treatments = (to: string | null) =>
      Array.from({ length: 300 }, (_, i) =>
        treatmentOf(pleasedThenMoved(i + 1, content, to).step),
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

    expect(castOf(step)).toEqual([
      { name: "Ana Abel", title: "Boss, YOUR-BOSS'S-BOSS" },
      { name: "Cal Cope", title: "Clerk, YOUR-BOSS" },
      { name: "Ben Bird", title: "Analyst" },
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

    const treated = Array.from({ length: 50 }, (_, i) =>
      treatmentOf(pleasedThenMoved(i + 1, content, "cal").step),
    );

    expect(treated.every((t) => t === null)).toBe(true);
  });

  it("writes in whoever is in the place where data names it", () => {
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
        if (view.result?.kind !== "happened") throw new Error(view.step.kind);
        return { holder, body: view.result.body };
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

  it("keeps a Promise with whoever was your boss when it was made", () => {
    const content = parseContent(placesFixtureRaw());
    const run = startRun({ seed: 1, content });
    run.choose({
      type: "notification",
      notificationId: "memo",
      optionId: "promise",
    });
    toNextMonth(run);
    const moved = movePlayer(run, content, "cal");

    expect(run.view().promises.map((p) => p.to)).toEqual(["your boss"]);
    expect(moved.view().promises.map((p) => p.to)).toEqual([
      "your boss's boss",
    ]);
  });

  it("lists on the results only what came across to the boss at the end", () => {
    const content = parseContent(placesFixtureRaw());
    const { run } = pleasedThenMoved(1, content, "cal");
    let view = run.choose({
      type: "scene",
      sceneId: "meeting",
      optionId: "snub",
    });
    while (view.step.kind !== "results") {
      const choice = view.choices.at(-1);
      if (!choice) throw new Error(`Stuck at ${view.step.kind}.`);
      view = run.choose(choice);
    }

    expect(view.step.boss).toMatchObject({
      name: "Cal Cope",
      choices: [{ month: 2, choice: "Snub", landed: "LANDED-COOLER" }],
    });
  });

  it("treats a boss who moves up as the boss's boss, and leaves them out of regard", () => {
    const content = parseContent(upFixtureRaw());
    const signs = gameContent.overHead?.signs ?? [];
    const only = (mood: "warm" | "cold") =>
      signs
        .filter((s) => s.likelihood[mood] > 0)
        .filter((s) => s.likelihood[mood === "warm" ? "cold" : "warm"] === 0)
        .map((s) => s.text);
    const regardOf = (step: Parameters<typeof regardIn>[0]) =>
      regardIn(step).map((r) => r.who);
    const movedUp = (optionId: string) =>
      Array.from({ length: 100 }, (_, i) => {
        const run = startRun({ seed: i + 1, content });
        const before = openMeeting(run);
        run.choose({ type: "scene", sceneId: "meeting", optionId });
        toNextMonth(run);
        return { before, after: openMeeting(movePlayer(run, content, "cal")) };
      });

    const pleased = movedUp("please");
    const snubbed = movedUp("snub");

    for (const { before, after } of [...pleased, ...snubbed]) {
      expect(regardOf(before)).toEqual(["Cal Cope"]);
      expect(regardOf(after)).toEqual(["Ana Abel"]);
      expect(treatmentOf(after)).not.toBeNull();
      expect(treatmentOf(after, "head")).not.toBeNull();
    }
    const heads = (runs: typeof pleased) =>
      runs.map((r) => treatmentOf(r.after, "head"));
    expect(heads(pleased).some((t) => only("warm").includes(t ?? ""))).toBe(
      true,
    );
    expect(heads(pleased).some((t) => only("cold").includes(t ?? ""))).toBe(
      false,
    );
    expect(heads(snubbed).some((t) => only("cold").includes(t ?? ""))).toBe(
      true,
    );
    expect(heads(snubbed).some((t) => only("warm").includes(t ?? ""))).toBe(
      false,
    );
  });
});
