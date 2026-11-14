import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { castDealtFirst } from "../../src/engine/deal";
import { KINDS, tally } from "../engine/signs-tally";

describe("what watching can tell the player, over many deals", () => {
  it("gives real evidence with the game's own signs", () => {
    const { counts, totals } = tally(gameContent, 2000);

    // Every sign a role of Floor 1's cast can show: a later floor's are not at its meeting.
    const first = new Set(
      castDealtFirst(gameContent).map(
        (id) => gameContent.characters.find((c) => c.id === id)?.role,
      ),
    );
    const onFloor1 = new Set(
      gameContent.behaviours
        .filter((b) => b.roles?.some((r) => first.has(r)) ?? true)
        .map((b) => b.text),
    );
    const seen = [...counts].filter(([text]) => onFloor1.has(text));
    expect(seen.length).toBeGreaterThanOrEqual(8);
    for (const [text, count] of seen) {
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
