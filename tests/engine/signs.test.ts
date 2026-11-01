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

const KINDS = ["believer", "incompetent", "practitioner"] as const;

function signsFixtureRaw() {
  const raw = sceneFixtureRaw();
  raw.behaviours = [
    {
      id: "late",
      text: "{who} ARRIVES-LATE.",
      likelihood: { believer: 1, incompetent: 8, practitioner: 1 },
    },
    {
      id: "kind",
      text: "{who} ASKS-KINDLY.",
      likelihood: { believer: 8, incompetent: 1, practitioner: 3 },
    },
    {
      id: "scheme",
      text: "{who} TAKES-NOTES.",
      likelihood: { believer: 1, incompetent: 1, practitioner: 6 },
    },
  ];
  return raw;
}

function sceneOf(view: PlayerView) {
  if (view.step.kind !== "scene") throw new Error(view.step.kind);
  return view.step;
}

function openMeeting(seed: number, content: Content) {
  const run = startRun({ seed, content });
  let view = run.view();
  while (view.step.kind !== "actions") {
    const choice = view.choices[0];
    if (!choice) throw new Error("Stuck before the meeting.");
    view = run.choose(choice);
  }
  return {
    run,
    step: sceneOf(run.choose({ type: "action", actionId: "meeting" })),
  };
}

/** How often each kind shows each behaviour, across many deals. */
function tally(content: Content, seeds = 3000) {
  const names = new Map(content.characters.map((c) => [c.name, c.id]));
  const counts = new Map(
    content.behaviours.map((b) => [
      b.text,
      { believer: 0, incompetent: 0, practitioner: 0 },
    ]),
  );
  const totals = { believer: 0, incompetent: 0, practitioner: 0 };
  for (let seed = 1; seed <= seeds; seed++) {
    const { run, step } = openMeeting(seed, content);
    const { characters } = readHiddenTruth(run);
    for (const { who, text } of step.behaviours) {
      const kind = characters.find((c) => c.id === names.get(who))?.kind;
      const count = counts.get(text.replaceAll(who, "{who}"));
      if (!kind || !count) throw new Error(`Unknown sign: ${text}`);
      count[kind] += 1;
      totals[kind] += 1;
    }
  }
  return { counts, totals };
}

describe("signs written per kind", () => {
  it("shows one for each Character present, and nobody else", () => {
    const raw = signsFixtureRaw();
    raw.characters.push({ id: "dee", name: "Dee Dunn", title: "Director" });
    raw.hiddenTruth.charactersWithFact = 3;
    const content = parseContent(raw);

    const { step } = openMeeting(1, content);

    expect(step.behaviours.map((b) => b.who)).toEqual([
      "Ana Abel",
      "Ben Bird",
      "Cal Cope",
    ]);
  });

  it("fills in whichever Character shows the sign", () => {
    const seen = new Set<string>();
    const content = parseContent(signsFixtureRaw());
    for (let seed = 1; seed <= 200; seed++) {
      for (const { who, text } of openMeeting(seed, content).step.behaviours) {
        expect(text).toContain(who);
        expect(text).not.toContain("{who}");
        seen.add(text);
      }
    }

    // Three people and three behaviours: every pairing turns up.
    expect(seen.size).toBe(9);
  });

  it("shows no behaviours when content has none", () => {
    expect(
      openMeeting(1, parseContent(sceneFixtureRaw())).step.behaviours,
    ).toEqual([]);
  });

  it("stays the same however often the Scene is looked at", () => {
    const { run, step } = openMeeting(4, parseContent(signsFixtureRaw()));

    expect(sceneOf(run.view())).toEqual(step);
  });

  it("shows the same signs for the same seed and choices", () => {
    const content = parseContent(signsFixtureRaw());

    for (const seed of [1, 2, 3, 4, 5]) {
      expect(openMeeting(seed, content).step).toEqual(
        openMeeting(seed, content).step,
      );
    }
  });

  it("varies the signs with the seed", () => {
    const content = parseContent(signsFixtureRaw());
    const shown = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        JSON.stringify(openMeeting(seed, content).step.behaviours),
      ),
    );

    expect(shown.size).toBeGreaterThan(1);
  });

  it("deals a fresh sign when the next month's Scene opens", () => {
    const content = parseContent(signsFixtureRaw());
    const months = (seed: number) => {
      const { run, step } = openMeeting(seed, content);
      let view = run.view();
      while (view.month === 1) {
        view = run.choose(view.choices.at(-1) as never);
      }
      while (view.step.kind !== "actions") {
        view = run.choose(view.choices[0] as never);
      }
      return [
        step.behaviours,
        sceneOf(run.choose({ type: "action", actionId: "meeting" })).behaviours,
      ];
    };

    const differs = [1, 2, 3, 4, 5, 6, 7, 8].some((seed) => {
      const [first, second] = months(seed);
      return JSON.stringify(first) !== JSON.stringify(second);
    });

    expect(differs).toBe(true);
  });

  it("never shows a Character's kind", () => {
    const content = parseContent(signsFixtureRaw());
    const labels = Object.values(content.hiddenTruth.kinds).map((k) => k.label);

    for (const seed of [1, 2, 3, 4, 5]) {
      const seen = JSON.stringify(openMeeting(seed, content).step);
      for (const label of labels) expect(seen).not.toContain(label);
      for (const kind of KINDS) expect(seen).not.toContain(kind);
    }
  });
});

describe("signs of who holds influence", () => {
  function misleadingRaw(chance: number) {
    const raw = sceneFixtureRaw();
    raw.balance.signsMisleadChance = chance;
    const scene = raw.scenes[0];
    if (scene) {
      scene.signs = [
        {
          label: "Who everyone looks at",
          text: "Everyone looks at {holder}.",
          clue: "CLUE: everyone looked at {holder}.",
        } as (typeof scene.signs)[number],
      ];
    }
    return raw;
  }

  function pointsAtHolder(seed: number, content: Content) {
    const { run, step } = openMeeting(seed, content);
    const holder = content.characters.find(
      (c) => c.id === readHiddenTruth(run).powerMap.order[0],
    )?.name;
    return step.signs[0]?.text.includes(holder ?? "?");
  }

  const SEEDS = Array.from({ length: 400 }, (_, i) => i + 1);

  it("is always right when the chance of misleading is zero", () => {
    const content = parseContent(misleadingRaw(0));

    expect(SEEDS.every((seed) => pointsAtHolder(seed, content))).toBe(true);
  });

  it("is usually right, and sometimes points at the wrong person", () => {
    const content = parseContent(misleadingRaw(0.25));

    const right = SEEDS.filter((seed) => pointsAtHolder(seed, content)).length;

    expect(right).toBeGreaterThan(SEEDS.length * 0.65);
    expect(right).toBeLessThan(SEEDS.length * 0.85);
  });

  it("is scored at the end according to whether it misled", () => {
    const content = parseContent(misleadingRaw(0.5));
    const verdicts = new Map<boolean, Set<string>>([
      [true, new Set()],
      [false, new Set()],
    ]);
    for (const seed of SEEDS) {
      const right = pointsAtHolder(seed, content) === true;
      const { run } = openMeeting(seed, content);
      let view = run.view();
      while (view.choices.length > 0) {
        view = run.choose(view.choices.at(-1) as never);
      }
      if (view.step.kind !== "results") throw new Error(view.step.kind);
      const clue = view.step.clues.find((c) => c.text.startsWith("CLUE"));
      verdicts.get(right)?.add(clue?.verdict ?? "");
    }

    expect(verdicts.get(true)).toEqual(new Set(["VERDICT-HELD"]));
    expect(verdicts.get(false)).toEqual(new Set(["VERDICT-FALSE"]));
  });
});

describe("what watching can tell the player", () => {
  it("sees every behaviour from at least two kinds", () => {
    const { counts } = tally(parseContent(signsFixtureRaw()));

    for (const [text, count] of counts) {
      const kinds = KINDS.filter((k) => count[k] > 0);
      expect(kinds.length, text).toBeGreaterThanOrEqual(2);
    }
  });

  it("sees a behaviour more often from the kinds it favours", () => {
    const { counts, totals } = tally(parseContent(signsFixtureRaw()));
    const rate = (text: string, kind: (typeof KINDS)[number]) =>
      (counts.get(text)?.[kind] ?? 0) / totals[kind];

    expect(rate("{who} ARRIVES-LATE.", "incompetent")).toBeGreaterThan(
      rate("{who} ARRIVES-LATE.", "believer") * 2,
    );
    expect(rate("{who} ASKS-KINDLY.", "believer")).toBeGreaterThan(
      rate("{who} ASKS-KINDLY.", "incompetent") * 2,
    );
    expect(rate("{who} TAKES-NOTES.", "practitioner")).toBeGreaterThan(
      rate("{who} TAKES-NOTES.", "believer") * 2,
    );
  });

  it("follows the likelihoods in data, with no change to code", () => {
    const raw = signsFixtureRaw();
    const late = raw.behaviours[0];
    if (!late) throw new Error("The fixture has no behaviours.");
    late.likelihood = { believer: 8, incompetent: 1, practitioner: 1 };

    const { counts, totals } = tally(parseContent(raw), 2000);
    const count = counts.get("{who} ARRIVES-LATE.");

    expect((count?.believer ?? 0) / totals.believer).toBeGreaterThan(
      (count?.incompetent ?? 0) / totals.incompetent,
    );
  });

  it("gives real evidence with the game's own signs", () => {
    const { counts, totals } = tally(gameContent, 2000);

    expect(counts.size).toBeGreaterThanOrEqual(8);
    for (const [text, count] of counts) {
      const rates = KINDS.map((k) => count[k] / totals[k]);
      expect(
        KINDS.filter((k) => count[k] > 0).length,
        text,
      ).toBeGreaterThanOrEqual(2);
      expect(Math.max(...rates), text).toBeGreaterThan(
        Math.min(...rates) * 1.3,
      );
    }
  });
});

describe("signs in content", () => {
  const breaks: [string, (b: RawBehaviour) => void, RegExp][] = [
    [
      "only one kind",
      (b) => {
        b.likelihood = { believer: 0, incompetent: 3, practitioner: 0 };
      },
      /only one kind/,
    ],
    [
      "the same likelihood from every kind",
      (b) => {
        b.likelihood = { believer: 2, incompetent: 2, practitioner: 2 };
      },
      /no evidence/,
    ],
    [
      "no {who} to fill in",
      (b) => {
        b.text = "Somebody is late.";
      },
      /\{who\}/,
    ],
    [
      "a token it cannot fill in",
      (b) => {
        b.text = "{who} glares at {holder}.";
      },
      /holder/,
    ],
    [
      "a named person",
      (b) => {
        b.text = "{who} glares at Ana.";
      },
      /names a Character/,
    ],
  ];

  it.each(breaks)("rejects a behaviour with %s", (_name, breakIt, message) => {
    const raw = signsFixtureRaw();
    const behaviour = raw.behaviours[0];
    if (!behaviour) throw new Error("The fixture has no behaviours.");
    breakIt(behaviour);

    expect(() => parseContent(raw)).toThrow(message);
  });

  it("rejects behaviours that leave a kind with nothing to show", () => {
    const raw = signsFixtureRaw();
    for (const behaviour of raw.behaviours) {
      behaviour.likelihood.believer = 0;
    }

    expect(() => parseContent(raw)).toThrow(/believer/);
  });
});

type RawBehaviour = ReturnType<typeof signsFixtureRaw>["behaviours"][number];
