import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { KINDS, type Kind, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { attendsEverything, walk } from "../engine/walk";
import { behavioursIn } from "../engine/scene-view";

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
          /\{(holder|ignored|bystander|subject|who|name|fact|source|said)\}/,
        );
      }
      expect(views.at(-1)?.step.kind).toBe("results");
    }
  });
});

describe("the balance of the deal", () => {
  // Half the seeds move each average below by under 0.01. Their thin limit is
  // `perfect`, at 0.36 against 0.40, and that is about the limit and not the count.
  const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

  /** The kind a careful reader would guess from the signs seen in a run. */
  function readerGuesses(
    views: readonly PlayerView[],
    named: ReadonlyMap<PlayerView, ReadonlyMap<string, string>>,
  ) {
    const { kinds } = gameContent.hiddenTruth;
    const total = Object.values(kinds).reduce((sum, k) => sum + k.weight, 0);
    const belief = new Map<string, Record<Kind, number>>();
    for (const c of gameContent.characters) {
      belief.set(c.id, {
        believer: Math.log(kinds.believer.weight / total),
        incompetent: Math.log(kinds.incompetent.weight / total),
        practitioner: Math.log(kinds.practitioner.weight / total),
      });
    }
    for (const view of views) {
      if (view.step.kind !== "scene") continue;
      for (const { who: name, text } of behavioursIn(view.step)) {
        const shownBy = gameContent.characters.find((c) => c.name === name);
        // Whoever is called this now, which follows a place or a seat's title.
        const who = named.get(view)?.get(shownBy?.id ?? "") ?? name;
        const written = gameContent.behaviours.find(
          (b) =>
            b.text.replaceAll("{who}", who).toLowerCase() ===
            text.toLowerCase(),
        );
        const held = belief.get(shownBy?.id ?? "");
        // A whistleblower's own signs say nothing of the kind they were dealt.
        const whistled = gameContent.changing?.whistleblower.signs.some(
          (s) =>
            s.text.replaceAll("{who}", who).toLowerCase() ===
            text.toLowerCase(),
        );
        if (whistled) continue;
        if (!written || !held) throw new Error(`Unknown sign: ${text}`);
        const role = shownBy?.role;
        const open = gameContent.behaviours.filter(
          (b) => role !== undefined && (b.roles?.includes(role) ?? true),
        );
        for (const kind of KINDS) {
          const sum = open.reduce((all, b) => all + b.likelihood[kind], 0);
          // A sign that one kind could never show still leaves room for doubt.
          held[kind] += Math.log(
            Math.max(written.likelihood[kind], 0.25) / sum,
          );
        }
      }
    }
    return belief;
  }

  /** What the reader made of one run: whom they got right, of the kinds dealt. */
  function readRun(seed: number) {
    const { run, views, named } = walk(seed, attendsEverything);
    const belief = readerGuesses(views, named);
    return readHiddenTruth(run).characters.map((dealt) => {
      const held = belief.get(dealt.id);
      if (!held) throw new Error("Nobody with that id.");
      const guess = KINDS.reduce((a, b) => (held[b] > held[a] ? b : a));
      return { kind: dealt.kind, right: guess === dealt.kind };
    });
  }

  // The runs are read a quarter at a time, each quarter once, so that no test
  // runs long. The test after reads any quarter not yet read.
  const QUARTERS = [0, 1, 2, 3].map((q) => SEEDS.slice(q * 50, q * 50 + 50));
  const read = new Map<number, ReturnType<typeof readRun>[]>();
  function readQuarter(q: number) {
    const known = read.get(q);
    if (known) return known;
    const runs = (QUARTERS[q] ?? []).map(readRun);
    read.set(q, runs);
    return runs;
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
    for (const run of QUARTERS.flatMap((_, q) => readQuarter(q))) {
      for (const dealt of run) {
        counts[dealt.kind] += 1;
        people += 1;
        if (dealt.right) right += 1;
      }
      if (run.every((dealt) => dealt.right)) everyoneRight += 1;
    }
    return {
      reading: right / people,
      guessing: Math.max(...Object.values(counts)) / people,
      perfect: everyoneRight / SEEDS.length,
    };
  }

  it.each([0, 1, 2, 3])(
    "reads every sign in a quarter of the runs: quarter %i",
    (q) => {
      expect(readQuarter(q)).toHaveLength(50);
    },
  );

  it("rewards a careful reader, without ever making them certain", () => {
    const { reading, guessing, perfect } = accuracy();

    // This reader knows the exact likelihoods, so a person will do worse.
    expect(reading).toBeGreaterThan(guessing + 0.15);
    expect(reading).toBeLessThan(0.85);
    expect(perfect).toBeLessThan(0.4);
  }, 120_000);
});
