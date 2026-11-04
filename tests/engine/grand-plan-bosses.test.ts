import { describe, expect, it } from "vitest";
import { parseContent, startRun } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import {
  answer,
  completed,
  movePlayer,
  play,
  raw,
  seedWhereBossIs,
  toldIn,
  untilNotification,
} from "./grand-plan-fixture";

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

describe("whose Grand Plan it is", () => {
  const content = parseContent(raw());

  it("is the boss's now, so a new boss brings a new one", () => {
    const first = startRun({ seed: 1, content });
    first.choose(answer("plan-told", "noted"));
    // Ben answers to Ana, so moving under him makes him the boss.
    const run = movePlayer(first, content, "ben");
    expect(run.view().grandPlan).toBeNull();

    const views = play(run, "noted-next", "paper-trail");

    const told = views.find(
      (v) => v.step.kind === "notification" && v.step.id === "next-told",
    );
    expect(told?.month).toBe(2);
    const heard = views.find((v) => v.grandPlan !== null);
    expect(heard?.grandPlan?.title).toBe("NEXT-PLAN-TITLE");
    expect(heard?.grandPlan?.status).toBe("RUNNING-TO-3");
    expect(readHiddenTruth(run).plans.map((p) => [p.id, p.boss])).toEqual([
      ["big-plan", "ana"],
      ["next-plan", "ben"],
      // Once his own has failed, Ben takes the one Ana had.
      ["big-plan", "ben"],
    ]);
  });

  it("is still followed to its end after the player moves away, and its boss can still blame them", () => {
    const first = startRun({ seed: 1, content });
    first.choose(answer("plan-told", "noted"));
    const run = movePlayer(first, content, "ben");

    const views = play(run, "noted-next", "leave");

    // Ana's Plan fails as month 3 opens, and Ben's as month 4 does.
    expect(toldIn(views, "BLAMED-YOU")).toEqual([3, 4]);
    expect(views.at(-1)?.step).toMatchObject({
      kind: "results",
      ending: { fired: true },
    });
  });

  it("can still be completed after the player moves away, as its own boss takes it", () => {
    const seed = seedWhereBossIs("believer", content);
    const first = startRun({ seed, content });
    first.choose(answer("plan-told", "noted"));
    const run = movePlayer(first, content, "ben");
    untilNotification(run, "plan-work");
    const before = readHiddenTruth(run).beliefs.ana ?? 0;

    const views = play(run, "on-paper", "noted-next");

    const [hers] = readHiddenTruth(run).plans;
    expect(hers?.ended).toMatchObject({ how: "appearance", counted: false });
    // It is told as a former boss's, not as the boss's now.
    expect(toldIn(views, "FORMER-BOSS-DONE")).toEqual([2]);
    expect(toldIn(views, "DONE-ON-PAPER")).toEqual([]);
    // Belief moves by Ana's kind, a Believer's, though she is no longer the boss.
    expect((readHiddenTruth(run).beliefs.ana ?? 0) - before).toBe(-2);
  });

  it("is one at a time: once a boss's Plan has ended, they take on the next", () => {
    const { run } = completed(1, content, "really");

    const views = play(run, "noted-next");

    expect(
      readHiddenTruth(run).plans.map((p) => [p.id, p.boss, p.month]),
    ).toEqual([
      ["big-plan", "ana", 1],
      ["next-plan", "ana", 3],
    ]);
    expect(
      views.find(
        (v) => v.step.kind === "notification" && v.step.id === "next-told",
      )?.month,
    ).toBe(3);
  });
});

describe("what a Grand Plan needs", () => {
  const content = parseContent(raw());
  const keeperOn = (seed: number) =>
    readHiddenTruth(startRun({ seed, content })).plans[0]?.keeper;

  it("is had by someone dealt from the seed, and never said in play", () => {
    const keepers = new Set(SEEDS.map(keeperOn));

    expect(keepers).toEqual(new Set(["ben", "cal"]));
  });

  it("completes it in reality from whoever really has it", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const asked = keeperOn(seed) === "ben" ? "ask-ben" : "ask-cal";

      const { run, view } = completed(seed, content, "with-them", asked);

      expect(view.step).toMatchObject({ title: "DONE-WITH-THEM" });
      expect(readHiddenTruth(run).plans[0]?.ended?.how).toBe("reality");
      expect(readHiddenTruth(run).risks).toEqual([]);
    }
  });

  it("falls back on being done in appearance from anyone else, with its risk", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const asked = keeperOn(seed) === "ben" ? "ask-cal" : "ask-ben";

      const { run, view, standingShift } = completed(
        seed,
        content,
        "with-them",
        asked,
      );

      expect(view.step).toMatchObject({ title: "DONE-WRONG" });
      expect(readHiddenTruth(run).plans[0]?.ended?.how).toBe("appearance");
      expect(readHiddenTruth(run).risks.map((r) => r.id)).toEqual(["hollow"]);
      // On the record it is done all the same, whoever had what it needed.
      expect(standingShift).toBeCloseTo(0.2);
    }
  });
});
