import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import type { StepView } from "../../src/engine";
import { playAll } from "./real-runs";

type Story = Extract<StepView, { kind: "story" }>;

/** Each written thing the official story can tell: a story entry or a Company Event's. */
const written = [
  ...gameContent.events.map((e) => e.story),
  ...gameContent.officialStory.entries,
];

/** A written line as a pattern, with any part such as {holder} filled by anyone. */
function pattern(line: string): RegExp {
  const parts = line
    .split(/\{\w+\}/)
    .map((piece) => piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${parts.join(".+")}$`, "i");
}

const says = (line: string | undefined, said: string | undefined) =>
  line === undefined
    ? said === undefined
    : said !== undefined && pattern(line).test(said);

/** Which written thing a pair was told from, by both its lines at once. */
const sourceOf = (pair: Story["pairs"][number]) =>
  written.findIndex(
    (w) => says(w.reported, pair.reported) && says(w.happened, pair.happened),
  );

const SEEDS = [1, 2, 3, 5, 8, 16];

const storiesOf = (seed: number) =>
  playAll(seed, null).flatMap((v) => (v.step.kind === "story" ? [v.step] : []));

describe("the official story", () => {
  it.each(SEEDS)(
    "pairs each reported line with what actually happened, from the same thing: seed %i",
    (seed) => {
      const pairs = storiesOf(seed).flatMap((s) => s.pairs);

      expect(pairs.length).toBeGreaterThan(0);
      for (const pair of pairs) {
        expect(pair.reported !== undefined || pair.happened !== undefined).toBe(
          true,
        );
        expect(sourceOf(pair), JSON.stringify(pair)).toBeGreaterThanOrEqual(0);
      }
    },
  );

  it("tells both sides of some things, and only one side of others", () => {
    const pairs = SEEDS.flatMap(storiesOf).flatMap((s) => s.pairs);

    expect(pairs.some((p) => p.reported && p.happened)).toBe(true);
    expect(pairs.some((p) => p.reported && !p.happened)).toBe(true);
    expect(pairs.some((p) => !p.reported && p.happened)).toBe(true);
  });

  it.each(SEEDS)(
    "keeps the pairs in the order things are told in the month: seed %i",
    (seed) => {
      for (const story of storiesOf(seed)) {
        const order = story.pairs.map(sourceOf);
        expect(order).toEqual([...order].sort((a, b) => a - b));
      }
    },
  );
});
