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
import { sceneFixtureRaw } from "./fixture";

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

const lines = (word: string) => ({
  believer: [`${word}-BELIEVER`],
  incompetent: [`${word}-INCOMPETENT`],
  practitioner: [`${word}-PRACTITIONER`],
});

function kindsFixtureRaw() {
  const raw = sceneFixtureRaw();
  raw.boss.approaches = [
    {
      id: "theatre",
      shift: { believer: -2, incompetent: 2, practitioner: 1 },
      reaction: lines("THEATRE"),
    },
  ];
  raw.scenes[0]?.options.push({
    id: "dazzle",
    label: "Dazzle",
    results: [{ body: "You dazzle.", approach: "theatre" }],
  });
  return raw;
}

/** The boss, whom `sceneFixtureRaw` makes Ana, dealt as each kind on some seed. */
function seedWhereBossIs(kind: Kind, content: Content): number {
  const seed = SEEDS.find((s) => {
    const { characters } = readHiddenTruth(startRun({ seed: s, content }));
    return characters.find((c) => c.id === "ana")?.kind === kind;
  });
  if (seed === undefined) throw new Error(`No seed deals a ${kind} boss.`);
  return seed;
}

function dazzle(seed: number, content: Content) {
  const run = startRun({ seed, content });
  run.choose({ type: "action", actionId: "meeting" });
  const view = run.choose({
    type: "scene",
    sceneId: "meeting",
    optionId: "dazzle",
  });
  if (view.step.kind !== "notice") throw new Error(view.step.kind);
  return { run, step: view.step };
}

describe("what impresses each kind of boss", () => {
  it("raises one kind's opinion and lowers another's with the same choice", () => {
    const content = parseContent(kindsFixtureRaw());
    const opinionOf = (kind: Kind) =>
      readHiddenTruth(dazzle(seedWhereBossIs(kind, content), content).run)
        .bossOpinion;

    expect(opinionOf("incompetent")).toBe(2);
    expect(opinionOf("practitioner")).toBe(1);
    expect(opinionOf("believer")).toBe(-2);
  });

  it("shows the reaction through signs, written for that kind", () => {
    const content = parseContent(kindsFixtureRaw());
    for (const kind of KINDS) {
      const { step } = dazzle(seedWhereBossIs(kind, content), content);

      expect(step.reaction).toBe(`THEATRE-${kind.toUpperCase()}`);
    }
  });

  it("adds to any flat opinion on the same result", () => {
    const raw = kindsFixtureRaw();
    const option = raw.scenes[0]?.options.at(-1);
    const result = option?.results[0];
    if (result) result.opinion = 1;
    const content = parseContent(raw);
    const seed = seedWhereBossIs("incompetent", content);

    expect(readHiddenTruth(dazzle(seed, content).run).bossOpinion).toBe(3);
  });

  it("lets an option write its own reaction", () => {
    const raw = kindsFixtureRaw();
    const result = raw.scenes[0]?.options.at(-1)?.results[0];
    if (result) {
      result.reaction = {
        believer: "OWN-BELIEVER",
        incompetent: "OWN-INCOMPETENT",
        practitioner: "OWN-PRACTITIONER",
      };
    }
    const content = parseContent(raw);
    const seed = seedWhereBossIs("believer", content);

    expect(dazzle(seed, content).step.reaction).toBe("OWN-BELIEVER");
  });

  it("gives a result that reads the boss's kind", () => {
    const raw = kindsFixtureRaw();
    raw.scenes[0]?.options.push({
      id: "read-the-boss",
      label: "Read the boss",
      results: [
        { when: { bossIs: "believer" }, body: "BELIEVER-BODY" },
        { body: "OTHER-BODY" },
      ],
    });
    const content = parseContent(raw);
    const bodyFor = (kind: Kind) => {
      const run = startRun({ seed: seedWhereBossIs(kind, content), content });
      run.choose({ type: "action", actionId: "meeting" });
      const { step } = run.choose({
        type: "scene",
        sceneId: "meeting",
        optionId: "read-the-boss",
      });
      return step.kind === "notice" ? step.body : step.kind;
    };

    expect(bodyFor("believer")).toBe("BELIEVER-BODY");
    expect(bodyFor("incompetent")).toBe("OTHER-BODY");
  });
});

describe("the boss's approaches in content", () => {
  it("refuses to start if an option is gated on the boss's kind", () => {
    const raw = kindsFixtureRaw();
    raw.scenes[0]?.options.push({
      id: "gated",
      label: "Gated",
      requires: { bossIs: "believer" },
      results: [{ body: "Gated." }],
    });

    expect(() => parseContent(raw)).toThrow(/gated on the hidden truth/);
  });

  it("refuses an option gated on a flag that gives the kind away", () => {
    const raw = kindsFixtureRaw();
    raw.scenes[0]?.options.push(
      {
        id: "tell",
        label: "Tell",
        results: [
          { when: { bossIs: "believer" }, body: "A", sets: ["boss-believes"] },
          { body: "B" },
        ],
      },
      {
        id: "gated",
        label: "Gated",
        requires: { flag: "boss-believes" },
        results: [{ body: "Gated." }],
      },
    );

    expect(() => parseContent(raw)).toThrow(/gated on the hidden truth/);
  });

  it("refuses an option gated on a flag from a Move that reads the kind", () => {
    const raw = kindsFixtureRaw();
    raw.moves.push({
      id: "tell",
      from: "Ana Abel",
      title: "Tell",
      body: "Told.",
      when: { bossIs: "practitioner" },
      sets: ["boss-practises"],
    });
    raw.scenes[0]?.options.push({
      id: "gated",
      label: "Gated",
      requires: { flag: "boss-practises" },
      results: [{ body: "Gated." }],
    });

    expect(() => parseContent(raw)).toThrow(/gated on the hidden truth/);
  });

  it("refuses an overdone reaction that says the kind out loud", () => {
    const raw = kindsFixtureRaw();
    const approach = raw.boss.approaches[0];
    if (approach) {
      approach.overdone = {
        after: 1,
        shift: {},
        reaction: { believer: ["Such a KIND-BELIEVER."] },
      };
    }

    expect(() => parseContent(raw)).toThrow(/names a kind/);
  });

  it("refuses a choice that names an unknown approach", () => {
    const raw = kindsFixtureRaw();
    const result = raw.scenes[0]?.options.at(-1)?.results[0];
    if (result) result.approach = "nonsense";

    expect(() => parseContent(raw)).toThrow(/unknown approach "nonsense"/);
  });

  it("refuses a reaction that says the kind out loud", () => {
    const raw = kindsFixtureRaw();
    const approach = raw.boss.approaches[0];
    if (approach) approach.reaction.believer = ["A true KIND-BELIEVER, then."];

    expect(() => parseContent(raw)).toThrow(/names a kind/);
  });

  it("refuses an approach that every kind takes the same way", () => {
    const raw = kindsFixtureRaw();
    const approach = raw.boss.approaches[0];
    if (approach) {
      approach.shift = { believer: 1, incompetent: 1, practitioner: 1 };
    }

    expect(() => parseContent(raw)).toThrow(/every kind/);
  });

  it("has choices in the game that split the kinds both ways", () => {
    const { approaches } = gameContent.boss;
    const splits = approaches.filter((a) => {
      const shifts = Object.values(a.shift);
      return shifts.some((s) => s > 0) && shifts.some((s) => s < 0);
    });
    const truth = approaches.find((a) => a.id === "truth");

    expect(splits.length).toBeGreaterThanOrEqual(3);
    // A true chart goes badly in most rooms, and can go well with a Believer.
    expect(truth?.shift.believer).toBeGreaterThan(0);
    expect(truth?.shift.incompetent).toBeLessThan(0);
    expect(truth?.shift.practitioner).toBeLessThan(0);
  });

  it("tags the animated deck, and the plain one as a true chart", () => {
    const deck = gameContent.notifications.find(
      (n) => n.id === "deck-for-upstairs",
    );

    expect(deck?.options.find((o) => o.id === "animate")?.approach).toBe(
      "theatre",
    );
    expect(deck?.options.find((o) => o.id === "plain")?.approach).toBe("truth");
  });
});

const BOSS = gameContent.boss.character;

function dealtBoss(run: Run): Kind {
  const kind = readHiddenTruth(run).characters.find((c) => c.id === BOSS)?.kind;
  if (kind === undefined) throw new Error("No boss was dealt.");
  return kind;
}

/** What this choice would do for this boss, going by its first listed result. */
function worthTo(kind: Kind, choice: Choice, view: PlayerView): number {
  const approachOf = (id: string | undefined) =>
    gameContent.boss.approaches.find((a) => a.id === id)?.shift[kind] ?? 0;
  if (choice.type === "scene" && view.step.kind === "scene") {
    const result = gameContent.scenes
      .find((s) => s.id === choice.sceneId)
      ?.options.find((o) => o.id === choice.optionId)
      ?.results.at(-1);
    return (result?.opinion ?? 0) + approachOf(result?.approach);
  }
  if (choice.type === "notification") {
    const option = allNotifications()
      .find((n) => n.id === choice.notificationId)
      ?.options.find((o) => o.id === choice.optionId);
    return (option?.opinion ?? 0) + approachOf(option?.approach);
  }
  return 0;
}

function allNotifications() {
  return [...gameContent.notifications, ...(gameContent.demands?.items ?? [])];
}

function approachOfChoice(choice: Choice): string | undefined {
  if (choice.type === "scene") {
    return gameContent.scenes
      .find((s) => s.id === choice.sceneId)
      ?.options.find((o) => o.id === choice.optionId)
      ?.results.at(-1)?.approach;
  }
  if (choice.type === "notification") {
    return allNotifications()
      .find((n) => n.id === choice.notificationId)
      ?.options.find((o) => o.id === choice.optionId)?.approach;
  }
  return undefined;
}

/** Plays a run going to the meeting each month, choosing by the given rule. */
function playOut(
  seed: number,
  choose: (choices: Choice[], view: PlayerView, kind: Kind) => Choice,
) {
  const run = startRun({ seed, content: gameContent });
  const kind = dealtBoss(run);
  let view = run.view();
  while (view.step.kind !== "results") {
    const meeting = view.choices.find(
      (c) => c.type === "action" && c.actionId.startsWith("meeting"),
    );
    const first = view.choices[0];
    if (!first) throw new Error(`Stuck at ${view.step.kind}.`);
    const isChoice =
      view.step.kind === "scene" || view.step.kind === "notification";
    const choice = isChoice
      ? choose(view.choices, view, kind)
      : (meeting ?? first);
    view = run.choose(choice);
  }
  return { run, view, opinion: readHiddenTruth(run).bossOpinion };
}

const adapts = (choices: Choice[], view: PlayerView, kind: Kind): Choice => {
  const best = [...choices].sort(
    (a, b) => worthTo(kind, b, view) - worthTo(kind, a, view),
  )[0];
  if (!best) throw new Error("Nothing to choose.");
  return best;
};

const alwaysUses =
  (approach: string) =>
  (choices: Choice[]): Choice => {
    const chosen =
      choices.find((c) => approachOfChoice(c) === approach) ??
      choices.find((c) => approachOfChoice(c) === undefined) ??
      choices[0];
    if (!chosen) throw new Error("Nothing to choose.");
    return chosen;
  };

const average = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

describe("playing the boss you have", () => {
  it("ends warmer for a player who adapts than one with one approach for all", () => {
    const seeds = SEEDS.slice(0, 60);
    const adapted = average(seeds.map((seed) => playOut(seed, adapts).opinion));

    for (const { id } of gameContent.boss.approaches) {
      const fixed = average(
        seeds.map((seed) => playOut(seed, alwaysUses(id)).opinion),
      );

      expect(adapted, id).toBeGreaterThan(fixed);
    }
  }, 30_000);

  it("never reveals the boss's kind in the player view before the run ends", () => {
    const labels = /Believer|Incompetent|Practitioner/;
    for (const seed of SEEDS.slice(0, 40)) {
      const run = startRun({ seed, content: gameContent });
      let view = run.view();
      let walk = seed;
      while (view.step.kind !== "results") {
        expect(JSON.stringify(view)).not.toMatch(labels);
        expect(JSON.stringify(view)).not.toMatch(
          /"(kind|approach)":"(believer|incompetent|practitioner|theatre|truth)"/,
        );
        walk = (walk * 31 + 7) % 1009;
        const safe = view.choices.filter(
          (c) =>
            !(
              c.type === "action" &&
              gameContent.actions.find((a) => a.id === c.actionId)?.findOut
            ),
        );
        const choice = safe[walk % safe.length];
        if (!choice) throw new Error(`Stuck at ${view.step.kind}.`);
        view = run.choose(choice);
      }
    }
  });
});

describe("the Annual Calibration's verdict", () => {
  const verdictFor = (seed: number, choose: typeof adapts) => {
    const { view } = playOut(seed, choose);
    if (view.step.kind !== "results") throw new Error(view.step.kind);
    return view.step.boss.verdict;
  };

  it("depends on the boss's opinion, with no number shown", () => {
    const seeds = SEEDS.slice(0, 60);
    const verdicts = new Set<string | null>();
    for (const seed of seeds) {
      verdicts.add(verdictFor(seed, adapts));
      verdicts.add(verdictFor(seed, alwaysUses("over-head")));
    }
    const written = gameContent.scenes.find(
      (s) => s.id === "calibration",
    )?.verdict;

    expect(verdicts).toContain(written?.warm);
    expect(verdicts).toContain(written?.cold);
    for (const verdict of Object.values(written ?? {})) {
      expect(verdict).not.toMatch(/\d/);
    }
  });

  it("comes with the result of the Scene", () => {
    const raw = kindsFixtureRaw();
    const scene = raw.scenes[0];
    if (scene) {
      scene.verdict = { warm: "V-WARM", neutral: "V-NEUTRAL", cold: "V-COLD" };
    }
    const content = parseContent(raw);
    const said = (kind: Kind) =>
      dazzle(seedWhereBossIs(kind, content), content).step.verdict;

    // The fixture's opinion goes warm at 1 and cold at -1.
    expect(said("incompetent")).toBe("V-WARM");
    expect(said("believer")).toBe("V-COLD");
  });
});

describe("the results screen on the boss", () => {
  const finish = (run: Run) => {
    let view = run.view();
    for (;;) {
      const choice = view.choices.at(-1);
      if (!choice) break;
      view = run.choose(choice);
    }
    if (view.step.kind !== "results") throw new Error(view.step.kind);
    return view.step;
  };

  it("shows the boss's kind and how each tagged choice landed", () => {
    const content = parseContent(kindsFixtureRaw());
    const seed = seedWhereBossIs("believer", content);
    const { run } = dazzle(seed, content);

    const { boss } = finish(run);

    expect(boss.kind).toBe("KIND-BELIEVER");
    expect(boss.name).toBe("Ana Abel");
    expect(boss.choices[0]).toEqual({
      month: 1,
      choice: "Dazzle",
      landed: content.ui.bossLanded.cooler,
    });
  });

  it("says when a choice warmed the boss, without a number", () => {
    const content = parseContent(kindsFixtureRaw());
    const { run } = dazzle(seedWhereBossIs("incompetent", content), content);

    const { boss } = finish(run);

    expect(boss.choices[0]?.landed).toBe(content.ui.bossLanded.warmer);
    expect(JSON.stringify(boss.choices)).not.toMatch(/-?\d+\}/);
  });
});
