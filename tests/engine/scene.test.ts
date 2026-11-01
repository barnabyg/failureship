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
    if (readHiddenTruth(run).powerMap.holder === holder) return run;
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

    expect(scene.cast).toEqual([
      { name: "Ana Abel", title: "Boss" },
      { name: "Ben Bird", title: "Analyst" },
      { name: "Cal Cope", title: "Clerk" },
    ]);
  });

  it.each(["ana", "ben", "cal"])(
    "shows signs that match the hidden truth when %s holds influence",
    (holder) => {
      const run = runWhereHolderIs(holder);
      const { powerMap } = readHiddenTruth(run);
      const name = (id: string) => NAMES[id] ?? id;

      const { signs } = sceneOf(openMeeting(run));

      expect(signs).toEqual([
        {
          label: "Who interrupts whom",
          text: `${name(holder)} talks over ${name(powerMap.ignored)}.`,
        },
        {
          label: "Who everyone looks at",
          text: `Everyone glances at ${name(holder)} before answering.`,
        },
        {
          label: "Who gets ignored",
          text: `Nobody responds to ${name(powerMap.ignored)}.`,
        },
      ]);
    },
  );

  it("does not leak the hidden truth into the player view", () => {
    const run = runWhereHolderIs("ben");
    const { characters, powerMap } = readHiddenTruth(run);

    const seen = JSON.stringify(openMeeting(run));

    for (const { fact } of characters) {
      if (fact) expect(seen).not.toContain(fact.text);
    }
    expect(seen).not.toContain("powerMap");
    expect(seen).not.toContain("holder");
    expect(seen).not.toContain(powerMap.holder);
    expect(seen).not.toContain("BACKED-RIGHT");
    expect(seen).not.toContain("BACKED-WRONG");
  });

  it("lays out the room the same way whoever holds influence", () => {
    const shape = (holder: string) => {
      const scene = sceneOf(openMeeting(runWhereHolderIs(holder)));
      return { cast: scene.cast, options: scene.options };
    };

    expect(shape("ana")).toEqual(shape("ben"));
    expect(shape("ana")).toEqual(shape("cal"));
  });

  it("gives a visible result for the choice", () => {
    const run = runWhereHolderIs("ana");
    openMeeting(run);

    const view = behave(run, "back-ana");

    expect(view.step).toEqual({
      kind: "notice",
      title: "The meeting",
      body: "BACKED-RIGHT: Ana Abel nods.",
    });
  });

  it("gives the same choice a different result under a different truth", () => {
    const backAnaWhenHolderIs = (holder: string) => {
      const run = runWhereHolderIs(holder);
      openMeeting(run);
      return behave(run, "back-ana").step;
    };

    expect(backAnaWhenHolderIs("ana")).not.toEqual(backAnaWhenHolderIs("ben"));
  });

  it("gives different choices different results under the same truth", () => {
    const resultOf = (optionId: string) => {
      const run = runWhereHolderIs("ana");
      openMeeting(run);
      return behave(run, optionId).step;
    };

    expect(resultOf("back-ana")).not.toEqual(resultOf("stay-quiet"));
  });

  it("returns to the month after the result", () => {
    const run = startRun({ seed: 1, content: sceneFixture() });
    openMeeting(run);
    behave(run, "stay-quiet");

    const view = run.choose({ type: "continue" });

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

    expect(step.signs[0]?.label).toBe("New sign");
    expect(step.options).toEqual([
      { id: "new-option", label: "A new way to behave" },
    ]);
    expect(behave(run, "new-option").step).toMatchObject({
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
        { label: "Whisper", text: `Someone mentions ${powerMap.holder}.` },
      ],
    });
    const run = startRun({
      seed: 1,
      content: parseContent(raw),
      sceneScripts: { whisper },
    });
    const { holder } = readHiddenTruth(run).powerMap;

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
      "an unknown role in the text",
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

type Scene = ReturnType<typeof sceneFixtureRaw>["scenes"][number];
