import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { gameContent, panelText } from "../../src/content";
import { startRun, type Choice, type PlayerView } from "../../src/engine";
import { plainChoice } from "../../src/ui/later-month";

/*
 * Whole runs of the real game, played by script on several seeds, and what the
 * player sees at every step, against a recorded baseline. A refactor that
 * changes nothing for the player passes it untouched.
 *
 * The baseline, player-views.baseline.txt beside this file, has a line for each
 * month of each run: a short hash of each view in turn, so a difference points
 * at the month and the step. When a change is meant to change play, check the
 * difference is the one intended, then record a new baseline with:
 *
 *   npx vitest run tests/engine/player-views.test.ts -u
 */

type Script = (view: PlayerView, turn: number) => Choice;

const choiceOf = (view: PlayerView, index: number): Choice => {
  const choice = view.choices[index % view.choices.length];
  if (!choice) throw new Error(`Stuck at ${view.step.kind}.`);
  return choice;
};

/** Takes whatever is offered with something at stake, or blames and cuts. */
function reckless(view: PlayerView): Choice {
  const { step } = view;
  const options =
    step.kind === "scene" || step.kind === "notification" ? step.options : [];
  const risky = options.find(
    (o) => o.stakes !== undefined || /^(blame|cut)-/.test(o.id),
  );
  if (risky && step.kind === "scene") {
    return { type: "scene", sceneId: step.id, optionId: risky.id };
  }
  if (risky && step.kind === "notification") {
    return {
      type: "notification",
      notificationId: step.id,
      optionId: risky.id,
    };
  }
  return plainChoice(view);
}

const scripts: Record<string, Script> = {
  plain: (view) => plainChoice(view),
  first: (view) => choiceOf(view, 0),
  last: (view) => choiceOf(view, view.choices.length - 1),
  // A different path on each seed, the same every time.
  walk: (view, turn) => choiceOf(view, (view.seed * 31 + turn * 7) % 1009),
  reckless,
};

const SEEDS = [1, 2, 3, 8];

/** The same text for the same view, whatever order its fields were built in. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const fields = Object.entries(value)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`);
    return `{${fields.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** What the player sees at a step: the view, their job title and the floor the tower draws. */
function seen(view: PlayerView) {
  return {
    ...view,
    jobTitle: panelText.jobTitle,
    floor: gameContent.floor.rooms,
  };
}

const hashOf = (view: PlayerView) =>
  createHash("sha256")
    .update(canonical(seen(view)))
    .digest("hex")
    .slice(0, 8);

function playWhole(seed: number, script: Script): PlayerView[] {
  const run = startRun({ seed, content: gameContent });
  const views = [run.view()];
  for (let turn = 0; ; turn++) {
    const view = views.at(-1) as PlayerView;
    if (view.choices.length === 0) return views;
    if (turn > 1000) throw new Error(`Seed ${String(seed)} never ended.`);
    views.push(run.choose(script(view, turn)));
  }
}

function playEveryScript() {
  return Object.entries(scripts).flatMap(([name, script]) =>
    SEEDS.map((seed) => ({
      name: `seed ${String(seed)} ${name}`,
      views: playWhole(seed, script),
    })),
  );
}

describe("the player views of whole scripted runs", () => {
  let runs: ReturnType<typeof playEveryScript> = [];

  beforeAll(() => {
    runs = playEveryScript();
  });

  it("match the recorded baseline at every step", async () => {
    const lines = runs.flatMap(({ name, views }) => {
      const months = new Map<number, string[]>();
      for (const view of views) {
        months.set(view.month, [
          ...(months.get(view.month) ?? []),
          hashOf(view),
        ]);
      }
      return [...months].map(
        ([month, hashes]) => `${name} m${String(month)}: ${hashes.join(" ")}`,
      );
    });

    await expect(`${lines.join("\n")}\n`).toMatchFileSnapshot(
      "player-views.baseline.txt",
    );
  });

  it("reach the results screen, fired at least once, having met both bosses", () => {
    const ends = runs.map(({ views }) => views.at(-1)?.step);
    const all = runs.flatMap(({ views }) => views);
    const steps = all.map((v) => v.step);

    expect(
      all.some((v) =>
        v.hotspots.some((h) => h.id === "over-head" && h.state === "done"),
      ),
    ).toBe(true);

    expect(ends.every((step) => step?.kind === "results")).toBe(true);
    expect(
      ends.some((step) => step?.kind === "results" && step.ending.fired),
    ).toBe(true);
    expect(
      steps.some((step) => step.kind === "scene" && step.treatment !== null),
    ).toBe(true);
    expect(
      steps.some(
        (step) => step.kind === "scene" && step.headTreatment !== null,
      ),
    ).toBe(true);
  });
});
