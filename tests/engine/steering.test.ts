import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { KINDS, startRun, type Kind, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";

/** Walks a whole run, with a pick made from what is on offer at each step. */
function walk(
  seed: number,
  pickFrom: (view: PlayerView, turn: number) => PlayerView["choices"][number],
) {
  const run = startRun({ seed, content: gameContent });
  const views = [run.view()];
  let view = views[0] as PlayerView;
  for (let turn = 0; view.choices.length > 0; turn++) {
    view = run.choose(pickFrom(view, turn));
    views.push(view);
  }
  return { run, views };
}

/** Always answers first, and goes to whatever is in the meeting room. */
function attendsEverything(view: PlayerView, turn: number) {
  const meeting = view.choices.find(
    (c) => c.type === "action" && c.actionId.startsWith("meeting"),
  );
  const choice = meeting ?? view.choices[turn % view.choices.length];
  if (!choice) throw new Error("No choice.");
  return choice;
}

function resultsOf(view: PlayerView | undefined) {
  if (view?.step.kind !== "results") throw new Error(view?.step.kind);
  return view.step;
}

describe("six months that do not feel like one month repeated", () => {
  it("gives every month its own Scene and Notifications", () => {
    const months = Array.from(
      { length: gameContent.balance.monthsPerRun },
      (_, i) => i + 1,
    );
    const inMonth = (item: { months?: number[] | undefined }, month: number) =>
      item.months?.includes(month) ?? true;
    const presented = months.map((month) => {
      const scenes = gameContent.scenes
        .filter((s) => inMonth(s, month))
        .map((s) => s.id);
      const notifications = gameContent.notifications
        .filter((n) => inMonth(n, month))
        .map((n) => n.id);
      expect(scenes, `month ${String(month)}`).toHaveLength(1);
      expect(notifications, `month ${String(month)}`).toHaveLength(1);
      return [...scenes, ...notifications];
    });

    expect(new Set(presented.flat()).size).toBe(months.length * 2);
  });

  it("opens a different Scene in each month of a real run", () => {
    const { views } = walk(1, attendsEverything);
    const titles = views.flatMap((v) =>
      v.step.kind === "scene" ? [v.step.title] : [],
    );

    expect(new Set(titles).size).toBe(6);
  });

  it("lands a different Move every month", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { views } = walk(seed, attendsEverything);
      const moves = views.flatMap((v) =>
        v.step.kind === "move" ? [v.step.title] : [],
      );

      expect(new Set(moves).size).toBe(moves.length);
      expect(moves).toHaveLength(6);
    }
  });

  it("tells a different official story every month", () => {
    const { views } = walk(1, attendsEverything);
    const stories = views.flatMap((v) =>
      v.step.kind === "story" ? [JSON.stringify(v.step.reported)] : [],
    );

    expect(new Set(stories).size).toBe(6);
  });

  it("names no particular month's meeting when a Scene is skipped", () => {
    const { views } = walk(1, (view, turn) => {
      const open = view.choices.filter(
        (c) => !(c.type === "action" && c.actionId.startsWith("meeting")),
      );
      const choice = open[turn % open.length];
      if (!choice) throw new Error("No choice.");
      return choice;
    });
    const reported = views.flatMap((v) =>
      v.step.kind === "story" ? v.step.reported : [],
    );

    expect(reported.join()).toContain("this month's meeting");
    expect(reported.join()).not.toContain("Monthly Alignment");
  });

  it("reads differently at the same place in different months", () => {
    const told = new Set<string>();
    for (const action of ["kitchen", "one-to-one", "work"]) {
      const known = gameContent.actions.find((a) => a.id === action);
      told.add(known?.result?.body ?? "");
      for (const more of known?.moreResults ?? []) told.add(more.body);
    }

    expect(told.size).toBe(18);
  });
});

describe("the whole run", () => {
  it("always says what the player can do, on every seed and pick", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { views } = walk(seed, (view, turn) => {
        const choice =
          view.choices[(seed * 7 + turn * 3) % view.choices.length];
        if (!choice) throw new Error("No choice.");
        return choice;
      });

      for (const view of views) {
        expect(view.hint.trim()).not.toBe("");
        expect(JSON.stringify(view)).not.toMatch(
          /\{(holder|ignored|bystander|subject|who|name|fact|source)\}/,
        );
      }
      expect(views.at(-1)?.step.kind).toBe("results");
    }
  });

  it("deals visibly different runs from two seeds", () => {
    const seen = [1, 8].map((seed) => {
      const { run, views } = walk(seed, attendsEverything);
      return {
        deal: readHiddenTruth(run)
          .characters.map((c) => c.kind)
          .join(),
        results: JSON.stringify(resultsOf(views.at(-1)).characters),
      };
    });

    expect(seen[0]?.results).not.toEqual(seen[1]?.results);
  });
});

describe("the balance of the deal", () => {
  const SEEDS = Array.from({ length: 400 }, (_, i) => i + 1);

  /** The kind a careful reader would guess from the signs seen in a run. */
  function readerGuesses(views: readonly PlayerView[]) {
    const { kinds } = gameContent.hiddenTruth;
    const total = Object.values(kinds).reduce((sum, k) => sum + k.weight, 0);
    const belief = new Map<string, Record<Kind, number>>();
    for (const c of gameContent.characters) {
      belief.set(c.name, {
        believer: Math.log(kinds.believer.weight / total),
        incompetent: Math.log(kinds.incompetent.weight / total),
        practitioner: Math.log(kinds.practitioner.weight / total),
      });
    }
    for (const view of views) {
      if (view.step.kind !== "scene") continue;
      for (const { who, text } of view.step.behaviours) {
        const written = gameContent.behaviours.find(
          (b) => b.text.replaceAll("{who}", who) === text,
        );
        const held = belief.get(who);
        if (!written || !held) throw new Error(`Unknown sign: ${text}`);
        for (const kind of KINDS) {
          const sum = gameContent.behaviours.reduce(
            (all, b) => all + b.likelihood[kind],
            0,
          );
          // A sign that one kind could never show still leaves room for doubt.
          held[kind] += Math.log(
            Math.max(written.likelihood[kind], 0.25) / sum,
          );
        }
      }
    }
    return belief;
  }

  /** Over many seeds: how often the reader is right, and how often a guess is. */
  function accuracy() {
    let right = 0;
    let everyoneRight = 0;
    let people = 0;
    const counts: Record<Kind, number> = {
      believer: 0,
      incompetent: 0,
      practitioner: 0,
    };
    for (const seed of SEEDS) {
      const { run, views } = walk(seed, attendsEverything);
      const belief = readerGuesses(views);
      const truth = readHiddenTruth(run).characters;
      let allRight = true;
      for (const dealt of truth) {
        const name = gameContent.characters.find(
          (c) => c.id === dealt.id,
        )?.name;
        const held = name === undefined ? undefined : belief.get(name);
        if (!held) throw new Error("Nobody by that name.");
        const guess = KINDS.reduce((a, b) => (held[b] > held[a] ? b : a));
        counts[dealt.kind] += 1;
        people += 1;
        if (guess === dealt.kind) right += 1;
        else allRight = false;
      }
      if (allRight) everyoneRight += 1;
    }
    return {
      reading: right / people,
      guessing: Math.max(...Object.values(counts)) / people,
      perfect: everyoneRight / SEEDS.length,
    };
  }

  it("rewards a careful reader, without ever making them certain", () => {
    const { reading, guessing, perfect } = accuracy();

    // This reader knows the exact likelihoods, so a person will do worse.
    expect(reading).toBeGreaterThan(guessing + 0.15);
    expect(reading).toBeLessThan(0.85);
    expect(perfect).toBeLessThan(0.4);
  }, 30_000);

  it("leaves no sign that settles a kind on its own", () => {
    for (const b of gameContent.behaviours) {
      expect(
        KINDS.filter((k) => b.likelihood[k] > 0).length,
        b.id,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("the owner's data files", () => {
  it("holds every word of the game in content, not in code", () => {
    // Anything not in a data file would fail to parse or be missing here.
    expect(gameContent.scenes.length).toBeGreaterThanOrEqual(6);
    expect(gameContent.notifications.length).toBeGreaterThanOrEqual(6);
    expect(gameContent.moves.length).toBeGreaterThanOrEqual(10);
    expect(gameContent.buzzwords.length).toBeGreaterThanOrEqual(3);
  });
});
