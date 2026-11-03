import { describe, expect, it } from "vitest";
import {
  KINDS,
  parseContent,
  startRun,
  type Kind,
  type PlayerView,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import {
  answer,
  completed,
  never,
  play,
  raw,
  seedWhereBossIs,
  titled,
  toldIn,
} from "./grand-plan-fixture";

describe("the boss's Grand Plan", () => {
  const content = parseContent(raw());

  it("is not in view until the player hears of it, and then says when it is due", () => {
    const run = startRun({ seed: 1, content });
    expect(run.view().grandPlan).toBeNull();

    const view = run.choose(answer("plan-told", "noted"));

    expect(view.grandPlan).toEqual({
      title: "BIG-PLAN-TITLE",
      what: "BIG-PLAN-WHAT",
      status: "RUNNING-TO-2",
    });
  });

  it("pleases one kind of boss and not another with the same completion", () => {
    const shift = (kind: Kind) =>
      completed(seedWhereBossIs(kind, content), content, "on-paper").shift;

    expect(shift("incompetent")).toBe(3);
    expect(shift("believer")).toBe(-2);
    expect(shift("practitioner")).toBe(1);
  });

  it("is counted done by the kinds of boss its way says, and not by the others", () => {
    const counted = (kind: Kind, way: string) =>
      readHiddenTruth(
        completed(seedWhereBossIs(kind, content), content, way).run,
      ).plans[0]?.ended?.counted;

    expect(KINDS.map((k) => counted(k, "on-paper"))).toEqual([
      false,
      true,
      true,
    ]);
    expect(KINDS.map((k) => counted(k, "really"))).toEqual([true, true, false]);
  });

  it("shows how the boss took it only through signs, and says Completed whether they count it or not", () => {
    for (const kind of KINDS) {
      const { view } = completed(
        seedWhereBossIs(kind, content),
        content,
        "really",
      );

      expect(view.step).toMatchObject({
        kind: "notice",
        title: "DONE-REALLY",
        reaction: `REALLY-${kind.toUpperCase()}`,
      });
      expect(view.grandPlan?.status).toBe("COMPLETED");
    }
  });

  it("goes on the official record the same way, whatever the boss's kind", () => {
    const shifts = KINDS.map(
      (kind) =>
        completed(seedWhereBossIs(kind, content), content, "on-paper")
          .standingShift,
    );

    for (const shift of shifts) expect(shift).toBeCloseTo(0.2);
  });

  it("adds a hidden risk when completed in appearance, and none when completed in reality", () => {
    const onPaper = completed(1, content, "on-paper").run;
    const really = completed(1, content, "really").run;

    expect(readHiddenTruth(onPaper).risks.map((r) => r.id)).toEqual(["hollow"]);
    expect(readHiddenTruth(really).risks).toEqual([]);
  });

  it("lets the risk of a Plan done in appearance come out later", () => {
    const { run } = completed(1, content, "on-paper");

    const views = play(run);

    expect(toldIn(views, "HOLLOW-OUT")).toEqual([3]);
    expect(readHiddenTruth(run).risks[0]?.cameOut).toMatchObject({
      month: 3,
      onPlayer: true,
    });
  });

  it("is completed only once", () => {
    const { run } = completed(1, content, "really");
    const views = play(run, "on-paper");

    expect(titled(views, "DONE-ON-PAPER")).toBeUndefined();
    expect(readHiddenTruth(run).risks).toEqual([]);
  });

  it("fails if it is not done when due, and the boss can blame the player for a big mistake", () => {
    const views = play(startRun({ seed: 1, content }), "noted", "leave");

    expect(toldIn(views, "BLAMED-YOU")).toEqual([3]);
    expect(views.at(-1)?.finalWarning).toBe(true);
    const failed = views.find(
      (v) => v.month === 3 && v.grandPlan?.title === "BIG-PLAN-TITLE",
    );
    expect(failed?.grandPlan?.status).toBe("FAILED");
  });

  it("can be blamed on someone else instead", () => {
    const blameless = parseContent(raw(never));

    const views = play(startRun({ seed: 1, content: blameless }), "leave");

    expect(titled(views, "BLAMED-YOU")).toBeUndefined();
    expect(toldIn(views, "BLAMED-THEM")).toEqual([3]);
    expect(views.at(-1)?.finalWarning).toBe(false);
  });

  it("is never blamed on the player when the blame cannot stick", () => {
    const views = play(startRun({ seed: 1, content }), "noted", "paper-trail");

    expect(titled(views, "BLAMED-YOU")).toBeUndefined();
    expect(toldIn(views, "BLAMED-THEM")).toEqual([3]);
  });

  it("never fails once completed", () => {
    const views = play(startRun({ seed: 1, content }), "noted", "really");

    expect(titled(views, "BLAMED-YOU")).toBeUndefined();
    expect(titled(views, "BLAMED-THEM")).toBeUndefined();
  });

  it("cannot be completed once past due, even by what the player does next", () => {
    const late = raw();
    late.notifications.unshift({
      id: "too-late",
      floor: "fixture-job",
      months: [3],
      from: "Your boss",
      subject: "Is it done yet?",
      body: "Well?",
      options: [{ id: "say-it-is", label: "Say it is", sets: ["looks-done"] }],
    });
    const content = parseContent(late);

    const views = play(startRun({ seed: 1, content }), "noted", "leave");

    expect(toldIn(views, "BLAMED-YOU")).toEqual([3]);
    expect(titled(views, "DONE-ON-PAPER")).toBeUndefined();
    expect(readHiddenTruth(startRun({ seed: 1, content })).plans).toHaveLength(
      1,
    );
  });

  it("is said on the results screen, with how it ended and who had what it needed", () => {
    const fate = (...answers: string[]) => {
      const { step } = play(startRun({ seed: 1, content }), ...answers).at(
        -1,
      ) as PlayerView;
      if (step.kind !== "results") throw new Error(step.kind);
      return step.grandPlans;
    };
    const keeper = readHiddenTruth(startRun({ seed: 1, content })).plans[0]
      ?.keeper;
    const called = keeper === "ben" ? "Ben Bird" : "Cal Cope";

    expect(fate("noted", "on-paper")[0]).toEqual({
      month: 1,
      name: "Ana Abel",
      title: "Boss",
      plan: "BIG-PLAN-TITLE",
      fate: "FATE-APPEARANCE",
      keeper: `${called} HAD-IT`,
    });
    expect(fate("noted", "really")[0]?.fate).toBe("FATE-REALITY");
    expect(fate("noted", "leave")[0]?.fate).toBe("FATE-FAILED");
  });
});
