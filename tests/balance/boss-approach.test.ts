import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { KINDS, startRun, type Kind } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { SEEDS, playIn, type Style } from "./styles";

const STYLE_NAMES: readonly Style[] = ["straight", "showy", "useful"];

/** Each run is played once, for whichever test reads it first. */
const runs = new Map<string, ReturnType<typeof playIn>>();
function playedIn(seed: number, style: Style) {
  const key = `${String(seed)} ${style}`;
  const known = runs.get(key);
  if (known) return known;
  const truth = playIn(seed, style);
  runs.set(key, truth);
  return truth;
}

/** The first sixty deals whose boss is dealt this kind. */
const dealt = new Map<Kind, number[]>();
function dealtA(kind: Kind) {
  const known = dealt.get(kind);
  if (known) return known;
  const seeds = SEEDS.filter(
    (s) =>
      readHiddenTruth(
        startRun({ seed: s, content: gameContent }),
      ).characters.find((c) => c.id === "boss")?.kind === kind,
  ).slice(0, 60);
  dealt.set(kind, seeds);
  return seeds;
}

/** The boss's mean belief in each style, over the deals that dealt it this kind. */
function meanBeliefs(kind: Kind): Record<Style, number> {
  const seeds = dealtA(kind);
  const mean = (style: Style) =>
    // The boss dealt that kind, whoever is the player's boss by the end.
    seeds.reduce((sum, s) => sum + (playedIn(s, style).beliefs.boss ?? 0), 0) /
    seeds.length;
  return {
    straight: mean("straight"),
    showy: mean("showy"),
    useful: mean("useful"),
  };
}

// Each kind of boss is played in each style in its own test, so that none
// runs long. The tests after read them all, and play any not yet played.
describe("the boss's belief, over whole runs", { timeout: 60_000 }, () => {
  it.each(KINDS.flatMap((kind) => STYLE_NAMES.map((s) => [kind, s] as const)))(
    "plays sixty deals with a boss dealt %s, coming across %s",
    (kind, style) => {
      for (const seed of dealtA(kind)) playedIn(seed, style);

      expect(dealtA(kind)).toHaveLength(60);
    },
  );

  describe("the approach has to change with the boss", () => {
    it("rewards a straight approach most with a Believer", () => {
      const { straight, showy, useful } = meanBeliefs("believer");

      expect(straight).toBeGreaterThan(Math.max(showy, useful));
    });

    it("rewards a showy approach most with an Incompetent", () => {
      const { straight, showy } = meanBeliefs("incompetent");

      expect(showy).toBeGreaterThan(straight);
    });

    it("rewards being useful most with a Practitioner", () => {
      const { straight, showy, useful } = meanBeliefs("practitioner");

      expect(useful).toBeGreaterThan(Math.max(straight, showy));
    });

    it("has no style that is best with every kind of boss", () => {
      const winner = (kind: Kind) => {
        const means = Object.entries(meanBeliefs(kind));
        return means.sort((a, b) => b[1] - a[1])[0]?.[0];
      };

      expect(
        new Set([
          winner("believer"),
          winner("incompetent"),
          winner("practitioner"),
        ]).size,
      ).toBeGreaterThan(1);
    });
  });

  // The first sixty deals are among those played above, whatever boss each
  // dealt, so this plays no run of its own.
  it("ends a run within reach of the thresholds, not many times past them", () => {
    const { warmAt } = gameContent.balance.mood;
    const finals = SEEDS.slice(0, 60).flatMap((seed) =>
      STYLE_NAMES.map((style) => playedIn(seed, style).bossBelief),
    );

    expect(Math.max(...finals.map(Math.abs))).toBeLessThan(warmAt * 5);
  });
});
