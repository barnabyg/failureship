import { describe, expect, it } from "vitest";
import {
  parseContent,
  startRun,
  type Content,
  type PlayerView,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { emptyMonth, emptyMonthRaw, sceneFixtureRaw } from "./fixture";

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

const powerMapOf = (seed: number, content = emptyMonth()) =>
  readHiddenTruth(startRun({ seed, content })).powerMap;

function playToEnd(seed: number, content: Content): PlayerView {
  const run = startRun({ seed, content });
  let view = run.view();
  for (;;) {
    const choice = view.choices[0];
    if (!choice) return view;
    view = run.choose(choice);
  }
}

describe("the Org Chart", () => {
  it("shows the formal hierarchy, from data", () => {
    expect(
      startRun({ seed: 1, content: emptyMonth() }).view().orgChart,
    ).toEqual([
      { name: "Ana Abel", title: "Boss", reportsTo: null },
      { name: "Ben Bird", title: "Analyst", reportsTo: "Ana Abel" },
      { name: "Cal Cope", title: "Clerk", reportsTo: "Ana Abel" },
    ]);
  });

  it("is the same for every seed", () => {
    const charts = new Set(
      SEEDS.map((seed) =>
        JSON.stringify(
          startRun({ seed, content: emptyMonth() }).view().orgChart,
        ),
      ),
    );

    expect(charts.size).toBe(1);
  });

  it.each([
    [
      "an unknown manager",
      (raw: Raw) => {
        (raw.characters[1] as { reportsTo?: string }).reportsTo = "zed";
      },
      /zed/,
    ],
    [
      "two Characters with the same name",
      (raw: Raw) => {
        (raw.characters[1] as { name: string }).name = "Ana Abel";
      },
      /share a name/,
    ],
    [
      "a loop in the hierarchy",
      (raw: Raw) => {
        (raw.characters[0] as { reportsTo?: string }).reportsTo = "ben";
      },
      /loop/,
    ],
  ])("rejects %s", (_name, breakIt, message) => {
    const raw = emptyMonthRaw();
    breakIt(raw);

    expect(() => parseContent(raw)).toThrow(message);
  });
});

describe("the Power Map", () => {
  it("gives everyone but the top person one person over them", () => {
    for (const seed of SEEDS) {
      const { order, influence } = powerMapOf(seed);
      expect([...order].sort()).toEqual(["ana", "ben", "cal"]);
      expect(influence.map((i) => i.over)).toEqual(order.slice(1));
      for (const { who, over } of influence) {
        expect(order.indexOf(who)).toBeLessThan(order.indexOf(over));
      }
    }
  });

  it("differs between seeds, and repeats for the same seed", () => {
    const maps = new Set(SEEDS.map((seed) => JSON.stringify(powerMapOf(seed))));

    expect(maps.size).toBeGreaterThan(3);
    expect(powerMapOf(7)).toEqual(powerMapOf(7));
  });

  it("can put someone junior over someone senior on the Org Chart", () => {
    const tops = new Set(SEEDS.map((seed) => powerMapOf(seed).order[0]));

    expect(tops).toEqual(new Set(["ana", "ben", "cal"]));
  });
});

describe("a Scene under the Power Map", () => {
  /** A fourth person outranks the room on some deals, but is never in it. */
  function withSomeoneAbsent() {
    const raw = sceneFixtureRaw();
    raw.characters.push({ id: "dee", name: "Dee Dunn", title: "Director" });
    raw.hiddenTruth.charactersWithFact = 3;
    raw.notifications = [];
    const scene = raw.scenes[0];
    if (!scene) throw new Error("The fixture has no Scene.");
    scene.signs = [
      { label: "Top", text: "{holder}" },
      { label: "Middle", text: "{bystander}" },
      { label: "Bottom", text: "{ignored}" },
    ];
    return parseContent(raw);
  }

  it("reads its roles from those present, in the dealt order", () => {
    const content = withSomeoneAbsent();
    const names = new Map(content.characters.map((c) => [c.id, c.name]));
    let absentOnTop = 0;
    for (const seed of SEEDS) {
      const run = startRun({ seed, content });
      const { order } = readHiddenTruth(run).powerMap;
      if (order[0] === "dee") absentOnTop += 1;
      const present = order.filter((id) => id !== "dee");

      const { step } = run.choose({ type: "action", actionId: "meeting" });
      if (step.kind !== "scene") throw new Error(step.kind);

      expect(step.signs.map((s) => s.text)).toEqual(
        [present[0], present[1], present[2]].map((id) => names.get(id ?? "")),
      );
    }
    expect(absentOnTop).toBeGreaterThan(0);
  });

  it("judges who holds influence among those present", () => {
    const content = withSomeoneAbsent();
    for (const seed of SEEDS) {
      const run = startRun({ seed, content });
      const { order } = readHiddenTruth(run).powerMap;
      const holder = order.find((id) => id !== "dee");
      run.choose({ type: "action", actionId: "meeting" });

      const { step } = run.choose({
        type: "scene",
        sceneId: "meeting",
        optionId: "back-ana",
      });

      expect(step).toMatchObject({
        body: expect.stringContaining(
          holder === "ana" ? "BACKED-RIGHT" : "BACKED-WRONG",
        ) as unknown,
      });
    }
  });

  it("rejects a Scene that names parts with too few people to fill them", () => {
    const raw = sceneFixtureRaw();
    const scene = raw.scenes[0];
    if (!scene) throw new Error("The fixture has no Scene.");
    scene.cast = ["ana", "ben"];

    expect(() => parseContent(raw)).toThrow(/three/);
  });
});

describe("the results screen", () => {
  it("shows the true Power Map, beside the Org Chart", () => {
    const content = emptyMonth();
    const names = new Map(content.characters.map((c) => [c.id, c.name]));
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { order, influence } = powerMapOf(seed, content);

      const view = playToEnd(seed, content);
      if (view.step.kind !== "results") throw new Error(view.step.kind);

      expect(view.step.powerMap.map((e) => e.name)).toEqual(
        order.map((id) => names.get(id)),
      );
      expect(view.step.powerMap.map((e) => e.reportsTo)).toEqual([
        null,
        ...influence.map((i) => names.get(i.who)),
      ]);
    }
  });
});

type Raw = ReturnType<typeof emptyMonthRaw>;
