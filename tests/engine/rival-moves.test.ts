import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  startRun,
  type Choice,
  type PlayerView,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { capitalised } from "../../src/engine/say";
import { plainChoice } from "../../src/ui/later-month";
import { buzzwordFixtureRaw, calledAtStart } from "./fixture";
import { everyLanded, firstTold, landedIn } from "./landed";
import {
  competitorMovesRaw,
  playOut,
  resultsOf,
  SEEDS,
  storyRaw,
  within,
} from "./rival-fixture";

describe("a competitor's Move", () => {
  it("is made by someone competing, of any kind, and credited only to a Rival", () => {
    const content = parseContent(competitorMovesRaw());
    const made = { rival: 0, other: 0, practitioner: 0, otherKind: 0 };

    for (const seed of SEEDS) {
      const run = startRun({ seed, content });
      const views = playOut(run);
      const truth = readHiddenTruth(run);
      const claimed = firstTold(views, "MOVE-CLAIMED");
      // Ana and Ben always compete, so it lands in the first month.
      expect(claimed?.month).toBe(1);
      const body = claimed?.told.body ?? "";
      const maker = ["ana", "ben"].find(
        (id) =>
          body ===
          `${capitalised(calledAtStart(content, id))} CLAIMED your work.`,
      );
      expect(maker).toBeDefined();
      const kind = truth.characters.find((c) => c.id === maker)?.kind;
      if (kind === "practitioner") made.practitioner += 1;
      else made.otherKind += 1;
      const rival = truth.rivals.find((r) => r.character === maker);
      if (rival) {
        made.rival += 1;
        expect(rival.did).toEqual([{ month: 1, move: "claimed" }]);
        expect(resultsOf(views).rivals).toContainEqual(
          expect.objectContaining({
            did: [{ month: 1, text: "MOVE-CLAIMED", family: "DEFLECT" }],
          }),
        );
      } else {
        made.other += 1;
        expect(truth.rivals.flatMap((r) => r.did)).toEqual([]);
      }
    }

    expect(made.rival).toBeGreaterThan(0);
    expect(made.other).toBeGreaterThan(0);
    // Practitioners are a third of those dealt here, and make more than that.
    expect(made.practitioner).toBeGreaterThan(made.otherKind / 2);
  });

  it("does not land while nobody competes", () => {
    const raw = competitorMovesRaw();
    raw.rivals.competing = [
      { id: "seat", for: "FOR-SEAT", who: ["cal"], when: { flag: "never" } },
    ];
    const content = parseContent(raw);
    for (const seed of SEEDS.slice(0, 40)) {
      const titles = everyLanded(playOut(startRun({ seed, content }))).flatMap(
        (l) => (l.kind === "move" ? [l.title] : []),
      );
      expect(titles).not.toContain("MOVE-CLAIMED");
    }
  });

  it("rejects {competitor} in a Move that no competitor makes", () => {
    const raw = competitorMovesRaw();
    const plain = raw.moves[1];
    if (plain) plain.body = "{competitor} did it.";

    expect(() => parseContent(raw)).toThrow(/says \{competitor\}, but is not/);
  });
});

describe("a false story about the player", () => {
  it("reaches only those it can travel to on the Power Map, and moves what they believe", () => {
    const content = parseContent(storyRaw(1));
    let told = 0;
    let missed = 0;

    for (const seed of SEEDS) {
      const run = startRun({ seed, content });
      playOut(run);
      const { memories, powerMap, news, beliefs } = readHiddenTruth(run);
      const story = news.findIndex((n) => n.text === "STORY-IN-TROUBLE");
      if (story < 0) continue;
      const teller = news[story]?.startedBy ?? "";
      const heard = memories.filter((m) => m.news === story);
      const reachable = within(powerMap, teller, 1);

      // Passed on at every chance, it reaches all of them and nobody else.
      expect(new Set(heard.map((m) => m.character))).toEqual(reachable);
      for (const memory of heard) {
        if (memory.character === teller) continue;
        told += 1;
        expect(memory.via).toBe(teller);
        // The boss's belief carries on moving with the month, so look at the rest.
        if (memory.character !== "ana") {
          expect(beliefs[memory.character]).toBe(-1);
        }
      }
      // The one who made it up knows better.
      expect(beliefs[teller] ?? 0).toBe(0);
      missed += content.characters.length - reachable.size;
    }

    expect(told).toBeGreaterThan(0);
    expect(missed).toBeGreaterThan(0);
  });

  it("travels further where the data lets it, along the same ties", () => {
    const content = parseContent(storyRaw(2));
    for (const seed of SEEDS.slice(0, 60)) {
      const run = startRun({ seed, content });
      playOut(run);
      const { memories, powerMap, news } = readHiddenTruth(run);
      const story = news.findIndex((n) => n.text === "STORY-IN-TROUBLE");
      if (story < 0) continue;
      const reachable = within(powerMap, news[story]?.startedBy ?? "", 2);
      for (const memory of memories.filter((m) => m.news === story)) {
        expect(reachable.has(memory.character)).toBe(true);
      }
    }
  });

  it("is told once, even when the same Move lands again", () => {
    const raw = storyRaw(1);
    raw.moves = raw.moves.slice(0, 1);
    const content = parseContent(raw);
    for (const seed of SEEDS.slice(0, 40)) {
      const run = startRun({ seed, content });
      const landed = everyLanded(playOut(run)).filter((l) => l.kind === "move");
      expect(landed.length).toBeGreaterThan(1);
      const stories = readHiddenTruth(run).news.filter(
        (n) => n.startedBy !== undefined,
      );
      expect(stories).toHaveLength(1);
    }
  });

  it("can be found out, which undoes what it did to that person", () => {
    const content = parseContent(storyRaw(1, 1));
    let found = 0;

    for (const seed of SEEDS) {
      const run = startRun({ seed, content });
      const views = playOut(run);
      const { memories, news, beliefs, characters } = readHiddenTruth(run);
      const story = news.findIndex((n) => n.text === "STORY-IN-TROUBLE");
      for (const memory of memories.filter((m) => m.news === story)) {
        const kind = characters.find((c) => c.id === memory.character)?.kind;
        const believer = kind === "believer";
        const teller = memory.via === null;
        expect(memory.foundOut !== null).toBe(believer && !teller);
        if (!believer || teller || memory.character === "ana") continue;
        found += 1;
        expect(beliefs[memory.character]).toBe(0);
        const name = content.characters.find(
          (c) => c.id === memory.character,
        )?.name;
        const reached = resultsOf(views).beliefs.find(
          (b) => b.name === name,
        )?.reached;
        expect(reached).toContainEqual(
          expect.objectContaining({
            text: "STORY-IN-TROUBLE",
            how: expect.stringContaining("FOUND-OUT-IN 3") as unknown,
          }),
        );
      }
    }

    expect(found).toBeGreaterThan(0);
  });
});

/** The player can tell Ben a story about Cal at the meeting, once they have the means. */
function playersStoryRaw(foundOut = 0) {
  const raw = storyRaw(1, foundOut);
  raw.scenes[0]?.options.push({
    id: "tell-a-story",
    label: "TELL-A-STORY",
    results: [
      {
        body: "TOLD",
        falseStory: {
          about: "cal-in-trouble",
          text: "STORY-ABOUT-CAL",
          of: "cal",
          at: ["ben"],
          exposed: { about: "made-it-up", text: "YOU-MADE-IT-UP" },
        },
      },
    ],
  });
  return raw;
}

/** Tells the story at the first month's meeting, then plays on. */
function tellTheStory(seed: number, foundOut = 0) {
  const content = parseContent(playersStoryRaw(foundOut));
  const run = startRun({ seed, content });
  run.choose({ type: "action", actionId: "meeting" });
  run.choose({ type: "scene", sceneId: "meeting", optionId: "tell-a-story" });
  return { run, views: playOut(run) };
}

describe("a false story the player tells", () => {
  it("starts with whoever they tell, travels as theirs does, and moves no belief in the player", () => {
    let travelled = 0;
    for (const seed of SEEDS.slice(0, 60)) {
      const { run } = tellTheStory(seed);
      const { memories, news, powerMap } = readHiddenTruth(run);
      const story = news.findIndex((n) => n.text === "STORY-ABOUT-CAL");
      expect(news[story]).toMatchObject({ startedBy: "you", of: "cal" });
      const heard = memories.filter((m) => m.news === story);
      expect(heard.find((m) => m.character === "ben")?.via).toBe("you");
      const reachable = within(powerMap, "ben", 1);
      for (const memory of heard) {
        expect(reachable.has(memory.character)).toBe(true);
        expect(memory.tone).toBeUndefined();
      }
      if (heard.length > 1) travelled += 1;
    }

    expect(travelled).toBeGreaterThan(0);
  });

  it("is traced back to the player by whoever sees through it", () => {
    let traced = 0;
    for (const seed of SEEDS.slice(0, 80)) {
      const { run } = tellTheStory(seed, 1);
      const { memories, news, characters } = readHiddenTruth(run);
      const story = news.findIndex((n) => n.text === "STORY-ABOUT-CAL");
      for (const memory of memories.filter((m) => m.news === story)) {
        const kind = characters.find((c) => c.id === memory.character)?.kind;
        expect(memory.foundOut !== null).toBe(kind === "believer");
        if (memory.foundOut === null) continue;
        traced += 1;
        expect(memories).toContainEqual(
          expect.objectContaining({
            character: memory.character,
            about: "made-it-up",
            tone: "bad",
            via: null,
          }),
        );
      }
    }

    expect(traced).toBeGreaterThan(0);
  });

  it("must say whom it is about and whom it is told to", () => {
    const raw = playersStoryRaw();
    const told = raw.scenes[0]?.options.at(-1)?.results[0]?.falseStory;
    if (told) delete told.at;

    expect(() => parseContent(raw)).toThrow(/whom it is about and whom/);
  });
});

describe("using a Move done to you", () => {
  /** An option to claim the credit back, open by seeing it done or learning the word. */
  function usingRaw() {
    const raw = {
      ...competitorMovesRaw(),
      notifications: buzzwordFixtureRaw().notifications,
    };
    raw.scenes[0]?.options.push({
      id: "claim-it-back",
      label: "CLAIM-IT-BACK",
      requires: {
        any: [{ sawMove: "claimed" }, { hasBuzzword: "fixture-word" }],
      },
      results: [{ body: "CLAIMED-BACK" }],
    });
    return raw;
  }

  const offered = (view: PlayerView | undefined) =>
    view?.step.kind === "scene" &&
    view.step.options.some((o) => o.id === "claim-it-back");

  /** Answers the month's Notification as asked, then plays the first choice. */
  function playAnswering(seed: number, optionId: string) {
    const run = startRun({ seed, content: parseContent(usingRaw()) });
    const views = [run.view()];
    for (;;) {
      const view = views.at(-1) as PlayerView;
      const { step } = view;
      const next: Choice | undefined =
        step.kind === "notification" && step.id === "invite"
          ? { type: "notification", notificationId: "invite", optionId }
          : (view.choices.find(
              (c) => c.type === "action" && c.actionId === "meeting",
            ) ?? view.choices[0]);
      if (!next) return views;
      views.push(run.choose(next));
    }
  }

  it("is on offer once the player has seen it done to them, and not before", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const views = playAnswering(seed, "report");
      const meetings = views.filter((v) => v.step.kind === "scene");
      expect(offered(meetings[0])).toBe(false);
      // Ana and Ben always compete, so the credit is claimed in month 1.
      expect(offered(meetings[1])).toBe(true);
    }
  });

  it("is on offer at once to a player who has the Buzzword for it", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const meetings = playAnswering(seed, "pub").filter(
        (v) => v.step.kind === "scene",
      );
      expect(offered(meetings[0])).toBe(true);
    }
  });

  it("must name a Move there is", () => {
    const raw = usingRaw();
    const option = raw.scenes[0]?.options.at(-1);
    if (option) option.requires = { sawMove: "clamied" };

    expect(() => parseContent(raw)).toThrow(/unknown Move "clamied"/);
  });
});

describe("the game's ways to the same Move", () => {
  /** Plays plainly to month 6's metric review, learning the Buzzword in month 4 if asked. */
  function metricReview(seed: number, learn: boolean) {
    const run = startRun({ seed, content: gameContent });
    let view = run.view();
    const tricky = new Set(["tricky-question", "pointed-question"]);
    let seen = false;
    while (view.step.kind !== "scene" || view.step.id !== "metric-review") {
      const { step } = view;
      for (const landed of landedIn(view)) {
        const written = gameContent.moves.find((m) => m.title === landed.title);
        if (landed.kind === "move" && written && tricky.has(written.id)) {
          seen = true;
        }
      }
      const deliver =
        learn && step.kind === "notification" && step.id === "new-tool";
      view = run.choose(
        deliver
          ? {
              type: "notification",
              notificationId: "new-tool",
              optionId: "deliver",
            }
          : plainChoice(view),
      );
    }
    const open = view.step.options.some(
      (o) => o.id === "tricky-question-analyst",
    );
    return { seen, open, words: view.buzzwords.map((b) => b.id) };
  }

  it("opens the tricky question to a player who saw one asked, or learnt the Buzzword", () => {
    let closed = 0;
    let learnt = 0;
    for (const seed of SEEDS.slice(0, 40)) {
      const plainly = metricReview(seed, false);
      expect(plainly.open).toBe(plainly.seen);
      if (!plainly.seen) closed += 1;
      const learning = metricReview(seed, true);
      if (learning.words.includes("single-source-of-truth")) {
        learnt += 1;
        expect(learning.open).toBe(true);
      }
    }

    expect(closed).toBeGreaterThan(0);
    expect(learnt).toBeGreaterThan(0);
    // docs/playtest.md plays this seed both ways.
    expect(metricReview(5, false).open).toBe(false);
    expect(metricReview(5, true).open).toBe(true);
  });

  it("makes the player's rumour the same Move as a Rival's: a false story", () => {
    const option = gameContent.scenes
      .flatMap((s) => s.options)
      .find((o) => o.id === "start-a-rumour");
    const told = option?.results.at(-1)?.falseStory;

    expect(told?.of).toBe("projects");
    expect(told?.exposed).toBeDefined();
    expect(option?.requires).toBeDefined();
  });
});
