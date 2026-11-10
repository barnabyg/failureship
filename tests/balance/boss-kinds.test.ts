import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  startRun,
  type Choice,
  type Kind,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

const BOSS = gameContent.you.reportsTo;

function dealtBoss(run: Run): Kind {
  const kind = readHiddenTruth(run).characters.find((c) => c.id === BOSS)?.kind;
  if (kind === undefined) throw new Error("No boss was dealt.");
  return kind;
}

/** What this choice would do for this boss, going by its first listed result. */
function worthTo(kind: Kind, choice: Choice, view: PlayerView): number {
  const approachOf = (id: string | undefined) =>
    gameContent.boss.approaches.find((a) => a.id === id)?.shift[kind] ?? 0;
  if (choice.type === "scene" && view.step.kind === "scene") {
    const result = gameContent.scenes
      .find((s) => s.id === choice.sceneId)
      ?.options.find((o) => o.id === choice.optionId)
      ?.results.at(-1);
    return (result?.opinion ?? 0) + approachOf(result?.approach);
  }
  if (choice.type === "notification") {
    const option = allNotifications()
      .find((n) => n.id === choice.notificationId)
      ?.options.find((o) => o.id === choice.optionId);
    return (option?.opinion ?? 0) + approachOf(option?.approach);
  }
  return 0;
}

function allNotifications() {
  return [...gameContent.notifications, ...(gameContent.demands?.items ?? [])];
}

function approachOfChoice(choice: Choice): string | undefined {
  if (choice.type === "scene") {
    return gameContent.scenes
      .find((s) => s.id === choice.sceneId)
      ?.options.find((o) => o.id === choice.optionId)
      ?.results.at(-1)?.approach;
  }
  if (choice.type === "notification") {
    return allNotifications()
      .find((n) => n.id === choice.notificationId)
      ?.options.find((o) => o.id === choice.optionId)?.approach;
  }
  return undefined;
}

/** Plays a run going to the meeting each month, choosing by the given rule. */
function playOut(
  seed: number,
  choose: (choices: Choice[], view: PlayerView, kind: Kind) => Choice,
) {
  const run = startRun({ seed, content: gameContent });
  const kind = dealtBoss(run);
  let view = run.view();
  while (view.step.kind !== "results") {
    const meeting = view.choices.find(
      (c) => c.type === "action" && c.actionId.startsWith("meeting"),
    );
    const first = view.choices[0];
    if (!first) throw new Error(`Stuck at ${view.step.kind}.`);
    const isChoice =
      view.step.kind === "scene" || view.step.kind === "notification";
    const choice = isChoice
      ? choose(view.choices, view, kind)
      : (meeting ?? first);
    view = run.choose(choice);
  }
  // The boss dealt that kind, even if someone else is the player's boss by the end.
  return { run, view, belief: readHiddenTruth(run).beliefs.boss ?? 0 };
}

const adapts = (choices: Choice[], view: PlayerView, kind: Kind): Choice => {
  const best = [...choices].sort(
    (a, b) => worthTo(kind, b, view) - worthTo(kind, a, view),
  )[0];
  if (!best) throw new Error("Nothing to choose.");
  return best;
};

const alwaysUses =
  (approach: string) =>
  (choices: Choice[]): Choice => {
    const chosen =
      choices.find((c) => approachOfChoice(c) === approach) ??
      choices.find((c) => approachOfChoice(c) === undefined) ??
      choices[0];
    if (!chosen) throw new Error("Nothing to choose.");
    return chosen;
  };

const average = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

describe("playing the boss you have", () => {
  it("ends warmer for a player who adapts than one with one approach for all", () => {
    // Ten is plenty: the gap is over 2.5 on all 30 sets of ten tried, and over
    // seven on this one.
    const seeds = SEEDS.slice(0, 10);
    const adapted = average(seeds.map((seed) => playOut(seed, adapts).belief));

    for (const { id } of gameContent.boss.approaches) {
      const fixed = average(
        seeds.map((seed) => playOut(seed, alwaysUses(id)).belief),
      );

      expect(adapted, id).toBeGreaterThan(fixed);
    }
  });
});

describe("the Annual Calibration's verdict", () => {
  const verdictFor = (seed: number, choose: typeof adapts) => {
    const { view } = playOut(seed, choose);
    if (view.step.kind !== "results") throw new Error(view.step.kind);
    return view.step.boss.verdict;
  };

  it("depends on the boss's mood, with no number shown", () => {
    const seeds = SEEDS.slice(0, 60);
    const verdicts = new Set<string | null>();
    for (const seed of seeds) {
      verdicts.add(verdictFor(seed, adapts));
      verdicts.add(verdictFor(seed, alwaysUses("over-head")));
    }
    const written = gameContent.scenes.find(
      (s) => s.id === "calibration",
    )?.verdict;

    expect(verdicts).toContain(written?.warm);
    expect(verdicts).toContain(written?.cold);
    for (const verdict of Object.values(written ?? {})) {
      expect(verdict).not.toMatch(/\d/);
    }
  });
});
