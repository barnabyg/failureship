import { describe, expect, it } from "vitest";
import {
  parseContent,
  startRun,
  type Content,
  type PlayerView,
  type Run,
  type SceneScript,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { sceneFixture, sceneFixtureRaw } from "./fixture";

const NAMES: Record<string, string> = {
  ana: "Ana Abel",
  ben: "Ben Bird",
  cal: "Cal Cope",
};

function runWhereHolderIs(holder: string, content: Content = sceneFixture()) {
  for (let seed = 1; seed < 200; seed++) {
    const run = startRun({ seed, content });
    if (readHiddenTruth(run).powerMap.order[0] === holder) return run;
  }
  throw new Error(`No seed makes ${holder} the holder.`);
}

function openMeeting(run: Run): PlayerView {
  return run.choose({ type: "action", actionId: "meeting" });
}

function sceneOf(view: PlayerView) {
  if (view.step.kind !== "scene") throw new Error(view.step.kind);
  return view.step;
}

function behave(run: Run, optionId: string) {
  return run.choose({ type: "scene", sceneId: "meeting", optionId });
}

describe("the meeting Scene", () => {
  it("spends an action and opens over the tower", () => {
    const run = startRun({ seed: 1, content: sceneFixture() });

    const view = openMeeting(run);

    expect(view.actions.remaining).toBe(2);
    expect(sceneOf(view)).toMatchObject({
      title: "The meeting",
      location: "Floor 1",
    });
    expect(view.hotspots.length).toBeGreaterThan(0);
  });

  it("names everyone in the room by their public title", () => {
    const scene = sceneOf(
      openMeeting(startRun({ seed: 1, content: sceneFixture() })),
    );

    expect(scene.people.map(({ name, title }) => ({ name, title }))).toEqual([
      { name: "Ana Abel", title: "Boss" },
      { name: "Ben Bird", title: "Analyst" },
      { name: "Cal Cope", title: "Clerk" },
    ]);
  });

  it.each(["ana", "ben", "cal"])(
    "shows signs that match the hidden truth when %s holds influence, each one that names only one person in their row",
    (holder) => {
      const run = runWhereHolderIs(holder);
      const ignored = readHiddenTruth(run).powerMap.order.at(-1) ?? "";
      const name = (id: string) => NAMES[id] ?? id;

      const { signs, people } = sceneOf(openMeeting(run));
      const signsOf = (id: string) =>
        people.find((p) => p.name === name(id))?.signs;

      expect(signs).toEqual([
        {
          label: "Who interrupts whom",
          text: `${name(holder)} talks over ${name(ignored)}.`,
        },
      ]);
      expect(signsOf(holder)).toEqual([
        {
          label: "Who everyone looks at",
          text: `Everyone glances at ${name(holder)} before answering.`,
        },
      ]);
      expect(signsOf(ignored)).toEqual([
        {
          label: "Who gets ignored",
          text: `Nobody responds to ${name(ignored)}.`,
        },
      ]);
    },
  );

  it("does not leak the hidden truth into the player view", () => {
    const run = runWhereHolderIs("ben");
    const { characters, powerMap } = readHiddenTruth(run);

    const { notebook, ...rest } = openMeeting(run);
    const seen = JSON.stringify(rest);

    // The Notebook lists everyone by id, always in the same order.
    expect(notebook.marks.map((m) => m.id)).toEqual(["ana", "ben", "cal"]);
    for (const { fact } of characters) {
      if (fact) expect(seen).not.toContain(fact.text);
    }
    expect(seen).not.toContain("powerMap");
    expect(seen).not.toContain("holder");
    expect(seen).not.toContain(powerMap.order[0]);
    expect(seen).not.toContain("BACKED-RIGHT");
    expect(seen).not.toContain("BACKED-WRONG");
  });

  it("lays out the room the same way whoever holds influence", () => {
    const shape = (holder: string) => {
      const scene = sceneOf(openMeeting(runWhereHolderIs(holder)));
      const cast = scene.people.map(({ name, title }) => ({ name, title }));
      return { cast, options: scene.options };
    };

    expect(shape("ana")).toEqual(shape("ben"));
    expect(shape("ana")).toEqual(shape("cal"));
  });

  it("gives a visible result for the choice", () => {
    const run = runWhereHolderIs("ana");
    openMeeting(run);

    const view = behave(run, "back-ana");

    expect(view.result).toEqual({
      kind: "happened",
      title: "The meeting",
      body: "BACKED-RIGHT: Ana Abel nods.",
      spent: "Go to meeting",
    });
  });

  it("gives the same choice a different result under a different truth", () => {
    const backAnaWhenHolderIs = (holder: string) => {
      const run = runWhereHolderIs(holder);
      openMeeting(run);
      return behave(run, "back-ana").result;
    };

    expect(backAnaWhenHolderIs("ana")).not.toEqual(backAnaWhenHolderIs("ben"));
  });

  it("gives different choices different results under the same truth", () => {
    const resultOf = (optionId: string) => {
      const run = runWhereHolderIs("ana");
      openMeeting(run);
      return behave(run, optionId).result;
    };

    expect(resultOf("back-ana")).not.toEqual(resultOf("stay-quiet"));
  });

  it("returns to the month after the result", () => {
    const run = startRun({ seed: 1, content: sceneFixture() });
    openMeeting(run);

    const view = behave(run, "stay-quiet");

    expect(view.step.kind).toBe("actions");
    expect(view.hotspots.find((h) => h.id === "meeting")?.state).toBe("done");
  });

  it("changes text, signs and choices through data alone", () => {
    const raw = sceneFixtureRaw();
    const scene = raw.scenes[0];
    if (!scene) throw new Error("The fixture has no Scene.");
    scene.signs = [{ label: "New sign", text: "{bystander} yawns." }];
    scene.options = [
      {
        id: "new-option",
        label: "A new way to behave",
        results: [{ body: "A new result." }],
      },
    ];
    const run = startRun({ seed: 1, content: parseContent(raw) });

    const step = sceneOf(openMeeting(run));

    expect(step.people.flatMap((p) => p.signs)).toEqual([
      expect.objectContaining({ label: "New sign" }),
    ]);
    expect(step.options).toEqual([
      { id: "new-option", label: "A new way to behave" },
    ]);
    expect(behave(run, "new-option").result).toMatchObject({
      body: "A new result.",
    });
  });

  it("lets a Scene that needs custom behaviour use code", () => {
    const raw = sceneFixtureRaw();
    const scene = raw.scenes[0];
    if (!scene) throw new Error("The fixture has no Scene.");
    scene.script = "whisper";
    const whisper: SceneScript = (data, { powerMap }) => ({
      ...data,
      signs: [
        ...data.signs,
        {
          label: "Whisper",
          text: `Someone mentions ${powerMap.order[0] ?? ""}.`,
        },
      ],
    });
    const run = startRun({
      seed: 1,
      content: parseContent(raw),
      sceneScripts: { whisper },
    });
    const holder = readHiddenTruth(run).powerMap.order[0] ?? "";

    expect(sceneOf(openMeeting(run)).signs.at(-1)?.text).toBe(
      `Someone mentions ${holder}.`,
    );
  });

  it("refuses to start when a Scene's script is missing", () => {
    const raw = sceneFixtureRaw();
    const scene = raw.scenes[0];
    if (!scene) throw new Error("The fixture has no Scene.");
    scene.script = "missing";

    expect(() => startRun({ seed: 1, content: parseContent(raw) })).toThrow(
      /missing/,
    );
  });

  it.each([
    [
      "an unknown part in the text",
      (s: Scene) => {
        s.signs = [{ label: "L", text: "{nobody}" }];
      },
      /nobody/,
    ],
    [
      "an option with no fallback result",
      (s: Scene) => {
        s.options = [
          {
            id: "o",
            label: "L",
            results: [{ when: { holderIs: "ana" }, body: "B" }],
          },
        ];
      },
      /fallback/,
    ],
    [
      "an unknown Character",
      (s: Scene) => {
        s.options = [
          {
            id: "o",
            label: "L",
            results: [{ when: { holderIs: "zed" }, body: "B" }, { body: "B" }],
          },
        ];
      },
      /zed/,
    ],
  ])("rejects a Scene with %s", (_name, breakIt, message) => {
    const raw = sceneFixtureRaw();
    const scene = raw.scenes[0];
    if (!scene) throw new Error("The fixture has no Scene.");
    breakIt(scene);

    expect(() => parseContent(raw)).toThrow(message);
  });
});

describe("the room, by person", () => {
  /** A boss's boss, Dee, and someone under her listed before the boss. */
  function chartedRaw() {
    const raw = sceneFixtureRaw();
    raw.characters = [
      { id: "cal", name: "Cal Cope", title: "Clerk", reportsTo: "ana" },
      { id: "eve", name: "Eve Ely", title: "Auditor", reportsTo: "dee" },
      { id: "ben", name: "Ben Bird", title: "Analyst", reportsTo: "ana" },
      { id: "ana", name: "Ana Abel", title: "Boss", reportsTo: "dee" },
      { id: "dee", name: "Dee Dunn", title: "Director" },
    ];
    raw.hiddenTruth.charactersWithFact = 3;
    const scene = raw.scenes[0];
    if (!scene) throw new Error("The fixture has no Scene.");
    scene.cast = ["cal", "eve", "ben", "ana", "dee"];
    return raw;
  }

  it("gives one row to each Character present, the bosses first and then the Org Chart's order", () => {
    const run = startRun({ seed: 1, content: parseContent(chartedRaw()) });

    const { people } = sceneOf(openMeeting(run));

    expect(people.map((p) => p.name)).toEqual([
      "Dee Dunn",
      "Ana Abel",
      "Eve Ely",
      "Cal Cope",
      "Ben Bird",
    ]);
  });

  it("puts what each Character did in that Character's row", () => {
    const raw = sceneFixtureRaw();
    raw.behaviours = [
      {
        id: "late",
        text: "{who} is late.",
        likelihood: { believer: 1, incompetent: 3, practitioner: 1 },
      },
      {
        id: "kind",
        text: "{who} is kind.",
        likelihood: { believer: 3, incompetent: 1, practitioner: 1 },
      },
    ] as typeof raw.behaviours;
    const run = startRun({ seed: 1, content: parseContent(raw) });

    const { people } = sceneOf(openMeeting(run));

    expect(people).toHaveLength(3);
    for (const { name, behaviour } of people) {
      expect([`${name} is late.`, `${name} is kind.`]).toContain(behaviour);
    }
  });

  const withYouIn = (plain?: boolean) => {
    // Every sign says the same, so whichever is drawn reads the same.
    const sign = (text: string, quiet?: boolean) =>
      [
        { id: "warm", likelihood: { warm: 2, neutral: 1, cold: 0 } },
        { id: "cold", likelihood: { warm: 0, neutral: 1, cold: 2 } },
        { id: "flat", likelihood: { warm: 1, neutral: 2, cold: 1 } },
      ].map((s) => ({
        ...s,
        text,
        ...(quiet === undefined ? {} : { plain: quiet }),
      }));
    const raw = {
      ...sceneFixtureRaw(),
      reputation: {
        travel: {
          hopsPerMonth: 1,
          maxHops: 1,
          passOnChance: 1,
          shift: { good: 1, bad: -1 },
        },
        mood: { warmAt: 1, coldAt: -1 },
        signs: sign("{who} looks up.", plain),
        believes: { warm: "W", neutral: "N", cold: "C" },
        how: { direct: "D", heardFrom: "H {who}" },
      },
    };
    raw.boss.signs = sign("Your boss waves.");
    const run = startRun({ seed: 1, content: parseContent(raw) });

    return sceneOf(openMeeting(run)).people.map((p) => p.withYou);
  };

  it("puts how the boss and everyone else are with you in their own rows", () => {
    expect(withYouIn()).toEqual([
      "Your boss waves.",
      "Ben Bird looks up.",
      "Cal Cope looks up.",
    ]);
  });

  it("leaves out a line that says nothing of note, rather than dimming it", () => {
    expect(withYouIn(true)).toEqual(["Your boss waves.", null, null]);
  });
});

type Scene = ReturnType<typeof sceneFixtureRaw>["scenes"][number];
