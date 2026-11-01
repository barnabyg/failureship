import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  ContentError,
  parseContent,
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth, type PowerMap } from "../../src/engine/hidden-truth";
import { fixtureRaw } from "./fixture";

const sign = (id: string, warm: number, neutral: number, cold: number) => ({
  id,
  text: `{who} SIGN-${id}`,
  likelihood: { warm, neutral, cold },
});

const reputation = (travel: object = {}) => ({
  travel: {
    hopsPerMonth: 1,
    maxHops: 2,
    passOnChance: 1,
    shift: { good: 1, bad: -1 },
    ...travel,
  },
  opinion: { warmAt: 1, coldAt: -1 },
  signs: [sign("warm", 9, 1, 0), sign("flat", 1, 9, 1), sign("cold", 0, 1, 9)],
  believes: { warm: "THINKS-WELL", neutral: "NO-VIEW", cold: "THINKS-BADLY" },
  how: { direct: "WAS-THERE", heardFrom: "HEARD-FROM {who}" },
});

function raw(travel: object = {}, tone = "bad", at = ["ben"]) {
  const base = fixtureRaw();
  base.balance.monthsPerRun = 5;
  base.notifications = [
    {
      id: "deed",
      months: [1],
      from: "F",
      subject: "S",
      body: "B",
      options: [
        {
          id: "do-it",
          label: "Do it",
          news: { about: "the-deed", tone, text: "DEED-WORDS", at },
        } as (typeof base.notifications)[number]["options"][number],
        { id: "leave-it", label: "Leave it" },
      ],
    },
  ];
  return { ...base, reputation: reputation(travel) };
}

function play(run: Run, optionId: string): PlayerView[] {
  let view = run.choose({
    type: "notification",
    notificationId: "deed",
    optionId,
  });
  const views = [view];
  while (view.choices.length > 0) {
    view = run.choose(view.choices[0] as Choice);
    views.push(view);
  }
  return views;
}

function resultsOf(views: PlayerView[]) {
  const { step } = views.at(-1) as PlayerView;
  if (step.kind !== "results") throw new Error(step.kind);
  return step;
}

/** Everyone within so many ties of influence of where the news started. */
function within(map: PowerMap, from: string[], hops: number): Set<string> {
  let reached = new Set(from);
  for (let i = 0; i < hops; i++) {
    const next = new Set(reached);
    for (const { who, over } of map.influence) {
      if (reached.has(who)) next.add(over);
      if (reached.has(over)) next.add(who);
    }
    reached = next;
  }
  return reached;
}

describe("news", () => {
  it("is known at once to those it was done in front of, or to", () => {
    const content = parseContent(raw());
    const run = startRun({ seed: 1, content });

    run.choose({
      type: "notification",
      notificationId: "deed",
      optionId: "do-it",
    });

    const { memories, beliefs } = readHiddenTruth(run);
    expect(memories.map((m) => m.character)).toEqual(["ben"]);
    expect(beliefs.ben).toBe(-1);
  });

  it("reaches only those connected to where it started", () => {
    const content = parseContent(raw({ maxHops: 1 }));
    for (let seed = 0; seed < 30; seed++) {
      const run = startRun({ seed, content });
      play(run, "do-it");
      const { memories, powerMap } = readHiddenTruth(run);
      const allowed = within(powerMap, ["ben"], 1);

      for (const memory of memories) {
        expect(allowed.has(memory.character)).toBe(true);
        if (memory.character !== "ben") {
          const tied = powerMap.influence.some(
            ({ who, over }) =>
              (who === memory.via && over === memory.character) ||
              (over === memory.via && who === memory.character),
          );
          expect(tied).toBe(true);
        }
      }
    }
  });

  it("goes no further than the data says", () => {
    const content = parseContent(raw({ maxHops: 0 }));
    const run = startRun({ seed: 1, content });

    play(run, "do-it");

    expect(readHiddenTruth(run).memories).toHaveLength(1);
  });

  it("goes no faster than the data says", () => {
    const hopsBy = (hopsPerMonth: number) => {
      const content = parseContent(raw({ maxHops: 5, hopsPerMonth }));
      const run = startRun({ seed: 4, content });
      run.choose({
        type: "notification",
        notificationId: "deed",
        optionId: "do-it",
      });
      let view = run.view();
      while (view.month < 2) view = run.choose(view.choices[0] as Choice);
      return readHiddenTruth(run).memories.length;
    };

    expect(hopsBy(1)).toBeLessThanOrEqual(hopsBy(5));
  });

  it("passes on at the chance the data says", () => {
    const content = parseContent(raw({ passOnChance: 0 }));
    const run = startRun({ seed: 1, content });

    play(run, "do-it");

    expect(readHiddenTruth(run).memories).toHaveLength(1);
  });

  it("travels whether it is good or bad", () => {
    for (const [tone, believes] of [
      ["good", "THINKS-WELL"],
      ["bad", "THINKS-BADLY"],
    ] as const) {
      const content = parseContent(raw({}, tone));
      const run = startRun({ seed: 1, content });
      const results = resultsOf(play(run, "do-it"));
      const heard = readHiddenTruth(run).memories.filter(
        (m) => m.character !== "ben" && m.character !== "ana",
      );

      expect(results.beliefs.find((b) => b.name === "Ben Bird")?.believes).toBe(
        believes,
      );
      expect(heard.every((m) => m.tone === tone)).toBe(true);
    }
  });

  it("gives Characters different beliefs, by what reached them", () => {
    const content = parseContent(raw({ maxHops: 0 }));
    const results = resultsOf(play(startRun({ seed: 1, content }), "do-it"));

    expect(results.beliefs.find((b) => b.name === "Ben Bird")?.believes).toBe(
      "THINKS-BADLY",
    );
    expect(results.beliefs.find((b) => b.name === "Cal Cope")?.believes).toBe(
      "NO-VIEW",
    );
  });

  it("reaches different people on different deals", () => {
    const content = parseContent(raw({ maxHops: 1 }));
    const reached = new Set(
      Array.from({ length: 30 }, (_, seed) => {
        const run = startRun({ seed, content });
        play(run, "do-it");
        return readHiddenTruth(run)
          .memories.map((m) => m.character)
          .sort()
          .join();
      }),
    );

    expect(reached.size).toBeGreaterThan(1);
  });

  it("moves the boss's opinion too, as the one idea of what they think", () => {
    const content = parseContent(raw({}, "bad", ["ana"]));
    const run = startRun({ seed: 1, content });

    run.choose({
      type: "notification",
      notificationId: "deed",
      optionId: "do-it",
    });

    const truth = readHiddenTruth(run);
    expect(truth.bossOpinion).toBe(-1);
    expect(truth.beliefs.ana).toBe(-1);
  });

  it("gives the same result on the same seed and choices", () => {
    const content = parseContent(raw({ passOnChance: 0.5 }));
    for (let seed = 0; seed < 10; seed++) {
      const once = startRun({ seed, content });
      const twice = startRun({ seed, content });
      play(once, "do-it");
      play(twice, "do-it");

      expect(readHiddenTruth(once)).toEqual(readHiddenTruth(twice));
    }
  });
});

describe("what the player sees", () => {
  const scene = {
    id: "room",
    title: "A room",
    location: "Here",
    narration: ["People are in it."],
    cast: ["ana", "ben", "cal"],
    signs: [],
    options: [{ id: "sit", label: "Sit", results: [{ body: "You sit." }] }],
  };
  const withScene = (travel: object = {}) => {
    const base = raw(travel);
    const meeting = { ...base.actions[0], scene: "room", result: undefined };
    return parseContent({
      ...base,
      scenes: [scene],
      actions: [meeting, ...base.actions.slice(1)],
    });
  };
  /** Goes to the room every month, and keeps each view of a Scene. */
  function scenesOf(run: Run, optionId: string) {
    let view = run.choose({
      type: "notification",
      notificationId: "deed",
      optionId,
    });
    const views: PlayerView[] = [view];
    while (view.choices.length > 0) {
      view = run.choose(view.choices[0] as Choice);
      views.push(view);
    }
    return views;
  }

  it("shows what someone believes through a sign, of everyone but the bosses", () => {
    const views = scenesOf(
      startRun({ seed: 1, content: withScene() }),
      "do-it",
    );
    const seen = views.flatMap((v) =>
      v.step.kind === "scene" ? [v.step.regard] : [],
    );

    expect(seen.length).toBeGreaterThan(0);
    for (const regard of seen) {
      expect(regard.map((r) => r.who).sort()).toEqual(["Ben Bird", "Cal Cope"]);
    }
  });

  it("has signs that follow what reached them, without settling it", () => {
    const signOf = (seed: number, optionId: string) =>
      scenesOf(startRun({ seed, content: withScene() }), optionId).flatMap(
        (v) =>
          v.step.kind === "scene"
            ? v.step.regard
                .filter((r) => r.who === "Ben Bird")
                .map((r) => r.text)
            : [],
      );
    const seeds = Array.from({ length: 40 }, (_, seed) => seed);
    const cold = (optionId: string) =>
      seeds
        .flatMap((seed) => signOf(seed, optionId))
        .filter((text) => text.includes("SIGN-cold")).length;

    expect(cold("do-it")).toBeGreaterThan(cold("leave-it"));
  });

  it("never shows a number, or says how anything reached anyone", () => {
    const run = startRun({ seed: 1, content: withScene() });
    const views = scenesOf(run, "do-it").filter(
      (v) => v.step.kind !== "results",
    );

    for (const view of views) {
      const said = JSON.stringify(view);
      for (const word of [
        "beliefs",
        "memories",
        "DEED-WORDS",
        "the-deed",
        "HEARD-FROM",
        "WAS-THERE",
        "THINKS-",
        '"via"',
        '"hops"',
        "powerMap",
        "influence",
      ]) {
        expect(said).not.toContain(word);
      }
    }
  });

  it("never reveals the Power Map through what someone believes", () => {
    // The same deal, with news that stops dead and news that goes everywhere.
    const reading = (maxHops: number, seed: number) =>
      scenesOf(startRun({ seed, content: withScene({ maxHops }) }), "do-it")
        .filter((v) => v.step.kind !== "results")
        .map((v) =>
          v.step.kind === "scene"
            ? { ...v, step: { ...v.step, regard: [] } }
            : v,
        );

    for (let seed = 0; seed < 20; seed++) {
      // Only the signs themselves differ, and they name no tie to anyone.
      expect(reading(5, seed)).toEqual(reading(0, seed));
    }
  });

  it("gives no sign that only one state of belief could show", () => {
    const { signs } = withScene().reputation ?? { signs: [] };

    expect(signs.length).toBeGreaterThan(0);
    for (const { likelihood } of signs) {
      expect(
        Object.values(likelihood).filter((l) => l > 0).length,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("says on the results screen what each believed, and how it reached them", () => {
    const content = parseContent(raw({ maxHops: 1 }));
    const run = startRun({ seed: 1, content });
    const { beliefs } = resultsOf(play(run, "do-it"));
    const heard = readHiddenTruth(run).memories.filter((m) => m.via);

    const ben = beliefs.find((b) => b.name === "Ben Bird");
    expect(ben?.reached).toEqual([
      { month: 1, text: "DEED-WORDS", how: "WAS-THERE" },
    ]);
    for (const memory of heard) {
      const shown = beliefs.flatMap((b) => b.reached);
      expect(shown.some((r) => r.how.startsWith("HEARD-FROM"))).toBe(true);
      expect(memory.hops).toBe(1);
    }
  });
});

describe("what moved a boss's belief", () => {
  it("always says what reached them", () => {
    const base = raw({ maxHops: 0 });
    const deed = base.notifications[0]?.options[1];
    if (deed) deed.opinion = 9;
    const content = parseContent(base);

    const { beliefs } = resultsOf(
      play(startRun({ seed: 1, content }), "leave-it"),
    );

    const boss = beliefs.find((b) => b.name === "Ana Abel");
    expect(boss?.believes).toBe("THINKS-WELL");
    expect(boss?.reached).toEqual([
      { month: 1, text: "Leave it", how: "WAS-THERE" },
    ]);
  });
});

describe("what is written", () => {
  it("refuses a sign that would settle what someone believes", () => {
    const base = raw();
    base.reputation.signs = [sign("only-cold", 0, 0, 1), sign("flat", 1, 1, 0)];
    expect(() => parseContent(base)).toThrow(ContentError);
  });

  it("refuses a sign that names nobody", () => {
    const base = raw();
    base.reputation.signs = [
      { ...sign("a", 1, 2, 0), text: "Someone is there." },
      sign("b", 0, 1, 2),
    ];
    expect(() => parseContent(base)).toThrow(/\{who\}/);
  });

  it("refuses news with no one for it to reach", () => {
    expect(() => parseContent(raw({}, "bad", ["nobody"]))).toThrow(
      ContentError,
    );
  });

  it("refuses news with no reputation written", () => {
    const base: Partial<ReturnType<typeof raw>> = raw();
    delete base.reputation;
    expect(() => parseContent(base)).toThrow(/no reputation/);
  });
});

describe("the real content", () => {
  const news = gameContent.scenes
    .flatMap((s) => s.options.flatMap((o) => o.results))
    .flatMap((r) => r.news ?? []);

  it("has news of both tones", () => {
    expect(new Set(news.map((n) => n.tone))).toEqual(new Set(["good", "bad"]));
  });

  it("sets how far and how fast news travels in the data", () => {
    expect(gameContent.reputation?.travel.maxHops).toBeGreaterThan(0);
    expect(gameContent.reputation?.travel.hopsPerMonth).toBeGreaterThan(0);
  });

  it("gives every Scene regard for those who are not bosses", () => {
    const run = startRun({ seed: 1, content: gameContent });
    let view = run.view();
    while (view.step.kind !== "scene") {
      const { step } = view;
      const free =
        step.kind === "notification"
          ? step.options.find((o) => o.costLabel === "Costs nothing")
          : undefined;
      const meeting = view.choices.find(
        (c) => c.type === "action" && c.actionId.startsWith("meeting"),
      );
      view = run.choose(
        step.kind === "notification" && free
          ? {
              type: "notification",
              notificationId: step.id,
              optionId: free.id,
            }
          : (meeting ?? (view.choices[0] as Choice)),
      );
    }

    expect(view.step.regard.length).toBe(3);
  });
});
