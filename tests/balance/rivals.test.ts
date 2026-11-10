import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice } from "../../src/ui/later-month";
import { SEEDS } from "../engine/rival-fixture";

describe("the game's Rivals", () => {
  /** Plays as the browser tests' plain player does, keeping every view. */
  function playPlainly(seed: number) {
    const run = startRun({ seed, content: gameContent });
    const views = [run.view()];
    let view = views[0] as PlayerView;
    while (view.choices.length > 0) {
      view = run.choose(plainChoice(view));
      views.push(view);
    }
    return { run, views };
  }

  it("names a maker who is sometimes a Rival and sometimes not", () => {
    const made = { rival: 0, other: 0 };
    const otherKinds = new Set<string>();
    for (const seed of SEEDS.slice(0, 120)) {
      const { run, views } = playPlainly(seed);
      const truth = readHiddenTruth(run);
      for (const view of views) {
        if (view.step.kind !== "move") continue;
        const { body } = view.step;
        const named = gameContent.characters.find(
          (c) =>
            body.toLowerCase().includes((c.called ?? c.name).toLowerCase()) ||
            (c.id === "boss" && /\byour boss\b(?!'s)/i.test(body)),
        );
        const written = gameContent.moves.find(
          (m) => m.title === (view.step as { title: string }).title,
        );
        if (written?.by !== "{competitor}" || !named) continue;
        const credited = truth.rivals.some((r) =>
          r.did.some((d) => d.month === view.month && d.move === written.id),
        );
        if (credited) made.rival += 1;
        else {
          made.other += 1;
          const kind = truth.characters.find((c) => c.id === named.id)?.kind;
          if (kind) otherKinds.add(kind);
        }
      }
    }

    expect(made.rival).toBeGreaterThan(made.other / 3);
    expect(made.other).toBeGreaterThan(10);
    expect(otherKinds.size).toBeGreaterThanOrEqual(2);
  });
});
