import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  startRun,
  type Content,
  type PlayerView,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { sceneFixtureRaw } from "./fixture";

function bossFixtureRaw() {
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
  const options = raw.scenes[0]?.options;
  options?.push(
    { id: "please", label: "Please", results: [{ body: "Good.", opinion: 2 }] },
    { id: "snub", label: "Snub", results: [{ body: "Bad.", opinion: -2 }] },
  );
  return raw;
}

function sceneOf(view: PlayerView) {
  if (view.step.kind !== "scene") throw new Error(view.step.kind);
  return view.step;
}

/** Makes one choice in month 1's meeting, then opens month 2's. */
function nextMeeting(seed: number, optionId: string, content: Content) {
  const run = startRun({ seed, content });
  run.choose({ type: "action", actionId: "meeting" });
  run.choose({ type: "scene", sceneId: "meeting", optionId });
  let view = run.view();
  while (view.month === 1) {
    const choice = view.choices.at(-1);
    if (!choice) throw new Error("Stuck in month 1.");
    view = run.choose(choice);
  }
  return {
    run,
    step: sceneOf(run.choose({ type: "action", actionId: "meeting" })),
  };
}

describe("the boss's opinion", () => {
  it("shows in how the boss treats the player in a later month", () => {
    const content = parseContent(bossFixtureRaw());
    const treatments = (optionId: string) =>
      Array.from(
        { length: 300 },
        (_, i) => nextMeeting(i + 1, optionId, content).step.treatment,
      );
    const count = (signs: (string | null)[], sign: string) =>
      signs.filter((s) => s === sign).length;

    const pleased = treatments("please");
    const snubbed = treatments("snub");

    expect(count(pleased, "SIGN-WARM")).toBeGreaterThan(200);
    expect(count(snubbed, "SIGN-COLD")).toBeGreaterThan(200);
    expect(count(pleased, "SIGN-COLD")).toBe(0);
    expect(count(snubbed, "SIGN-WARM")).toBe(0);
  });

  it("gives different signs on one seed after different choices", () => {
    const content = parseContent(bossFixtureRaw());

    const differs = [1, 2, 3, 4, 5].filter(
      (seed) =>
        nextMeeting(seed, "please", content).step.treatment !==
        nextMeeting(seed, "snub", content).step.treatment,
    );

    expect(differs.length).toBeGreaterThan(0);
  });

  it("stays deniable: a sign can come from more than one opinion", () => {
    const content = parseContent(bossFixtureRaw());
    const seen = new Set(
      Array.from(
        { length: 300 },
        (_, i) => nextMeeting(i + 1, "please", content).step.treatment,
      ),
    );

    expect(seen).toContain("SIGN-NEUTRAL");
  });

  it("is hidden truth, and never reaches the player view", () => {
    const content = parseContent(bossFixtureRaw());
    const { run } = nextMeeting(1, "please", content);

    expect(readHiddenTruth(run).bossOpinion).toBe(2);
    // The fixture's own sign says WARM, so this checks what the view is made of.
    const seen = JSON.stringify(run.view());
    expect(seen).not.toMatch(/opinion|likelihood|mood/i);
    expect(seen).not.toMatch(/"warm"|"neutral"|"cold"/);
    expect(sceneOf(run.view()).treatment).not.toMatch(/\d/);
  });

  it("shows no treatment when the boss is not in the room", () => {
    const raw = bossFixtureRaw();
    raw.boss.character = "ben";
    const scene = raw.scenes[0];
    if (scene) {
      scene.cast = ["ana", "cal"];
      scene.signs = [];
      scene.options = scene.options.filter((o) =>
        ["please", "snub", "stay-quiet"].includes(o.id),
      );
    }

    const { step } = nextMeeting(1, "please", parseContent(raw));

    expect(step.treatment).toBeNull();
  });

  it("stays the same however often the Scene is looked at", () => {
    const { run, step } = nextMeeting(
      3,
      "please",
      parseContent(bossFixtureRaw()),
    );

    expect(sceneOf(run.view())).toEqual(step);
  });

  it("is moved by a Notification's answer too", () => {
    const raw = {
      ...bossFixtureRaw(),
      notifications: [
        {
          id: "invite",
          from: "Boss",
          subject: "Pub?",
          body: "Coming?",
          options: [
            { id: "yes", label: "Yes", opinion: 1, result: notice },
            { id: "no", label: "No", opinion: -1, result: notice },
          ],
        },
      ],
    };
    const run = startRun({ seed: 1, content: parseContent(raw) });

    run.choose({
      type: "notification",
      notificationId: "invite",
      optionId: "no",
    });

    expect(readHiddenTruth(run).bossOpinion).toBe(-1);
  });
});

const notice = { title: "Done", body: "Done." };

describe("the boss's signs in content", () => {
  type RawSign = ReturnType<typeof bossFixtureRaw>["boss"]["signs"][number];
  const breaks: [string, (s: RawSign) => void, RegExp][] = [
    [
      "only one opinion",
      (s) => {
        s.likelihood = { warm: 3, neutral: 0, cold: 0 };
      },
      /only one opinion/,
    ],
    [
      "the same likelihood from every opinion",
      (s) => {
        s.likelihood = { warm: 2, neutral: 2, cold: 2 };
      },
      /no evidence/,
    ],
    [
      "a token it cannot fill in",
      (s) => {
        s.text = "{boss} nods.";
      },
      /unknown token/,
    ],
  ];

  it.each(breaks)("rejects a sign with %s", (_name, breakIt, message) => {
    const raw = bossFixtureRaw();
    const sign = raw.boss.signs[0];
    if (!sign) throw new Error("The fixture has no signs.");
    breakIt(sign);

    expect(() => parseContent(raw)).toThrow(message);
  });

  it("rejects a boss who is not a Character", () => {
    const raw = bossFixtureRaw();
    raw.boss.character = "nobody";

    expect(() => parseContent(raw)).toThrow(/nobody/);
  });

  it("rejects signs that leave an opinion with nothing to show", () => {
    const raw = bossFixtureRaw();
    for (const sign of raw.boss.signs) sign.likelihood.cold = 0;

    expect(() => parseContent(raw)).toThrow(/cold/);
  });

  it("has a game whose choices move the boss in both directions", () => {
    const shifts = [
      ...gameContent.notifications.flatMap((n) =>
        n.options.map((o) => o.opinion),
      ),
      ...gameContent.scenes.flatMap((s) =>
        s.options.flatMap((o) => o.results.map((r) => r.opinion)),
      ),
    ];

    expect(shifts.some((s) => s > 0)).toBe(true);
    expect(shifts.some((s) => s < 0)).toBe(true);
    expect(gameContent.boss.signs.length).toBeGreaterThanOrEqual(6);
  });
});
