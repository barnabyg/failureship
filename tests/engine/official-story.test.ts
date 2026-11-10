import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type StepView } from "../../src/engine";
import { plainChoice } from "../../src/ui/later-month";
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
    "opens with the month's own line, when the month has one: seed %i",
    (seed) => {
      const opening = new Set(
        gameContent.officialStory.entries
          .filter((e) => e.when === undefined)
          .map((e) => e.reported),
      );
      for (const story of storiesOf(seed)) {
        const lines = story.pairs.map((p) => p.reported);
        const first = lines.findIndex((line) => opening.has(line));
        if (first >= 0) expect(first).toBe(0);
      }
    },
  );
});

describe("the official story's order", () => {
  const lineFor = (flag: string) => {
    const entry = gameContent.officialStory.entries.find(
      (e) => e.when !== undefined && "flag" in e.when && e.when.flag === flag,
    );
    if (!entry?.happened) throw new Error(`No real line for ${flag}.`);
    return entry.happened;
  };

  /** Seed 1's first month, taking the two actions left in the order given. */
  function firstStory(order: readonly string[]) {
    const run = startRun({ seed: 1, content: gameContent });
    let view = run.view();
    const todo = [...order];
    while (view.step.kind !== "story") {
      const wanted = todo[0];
      const action = view.choices.find(
        (c) => c.type === "action" && c.actionId === wanted,
      );
      if (action) todo.shift();
      view = run.choose(action ?? plainChoice(view));
    }
    expect(todo).toEqual([]);
    return view.step.pairs.map((p) => p.happened ?? p.reported);
  }

  it("tells things in the order they happened in the month, not as written", () => {
    const tea = lineFor("had-tea");
    const work = lineFor("did-work");
    // As written, tea comes before work.
    const written = gameContent.officialStory.entries.map((e) => e.happened);
    expect(written.indexOf(tea)).toBeLessThan(written.indexOf(work));

    const workFirst = firstStory(["work", "kitchen"]);
    expect(workFirst.indexOf(work)).toBeGreaterThanOrEqual(0);
    expect(workFirst.indexOf(work)).toBeLessThan(workFirst.indexOf(tea));

    const teaFirst = firstStory(["kitchen", "work"]);
    expect(teaFirst.indexOf(tea)).toBeLessThan(teaFirst.indexOf(work));
  });

  it("opens with the month's own line, before anything the player did", () => {
    const story = firstStory(["work", "kitchen"]);
    const opening = gameContent.officialStory.entries.find(
      (e) => e.when === undefined && e.months?.includes(1),
    );
    expect(story[0]).toBe(opening?.reported);
  });
});
