import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type Kind } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { SEEDS, playIn, type Style } from "./styles";

/** Each kind's means are played once, for whichever test reads them first. */
const played = new Map<Kind, Record<Style, number>>();

function meanBeliefs(kind: Kind): Record<Style, number> {
  const known = played.get(kind);
  if (known) return known;
  const seeds = SEEDS.filter(
    (s) =>
      readHiddenTruth(
        startRun({ seed: s, content: gameContent }),
      ).characters.find((c) => c.id === "boss")?.kind === kind,
  ).slice(0, 60);
  const mean = (style: Style) =>
    // The boss dealt that kind, whoever is the player's boss by the end.
    seeds.reduce((sum, s) => sum + (playIn(s, style).beliefs.boss ?? 0), 0) /
    seeds.length;
  const means = {
    straight: mean("straight"),
    showy: mean("showy"),
    useful: mean("useful"),
  };
  played.set(kind, means);
  return means;
}

describe(
  "the approach has to change with the boss",
  { timeout: 60_000 },
  () => {
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
  },
);
