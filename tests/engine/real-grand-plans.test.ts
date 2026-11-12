import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  KINDS,
  resumeRun,
  startRun,
  type Choice,
  type Kind,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice, playToMonth } from "../../src/ui/later-month";
import { everySign } from "./scene-view";
import { landedIn } from "./landed";

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
const DONE = "Your boss's Grand Plan: done";

const newRun = (seed: number) => startRun({ seed, content: gameContent });

/** Plays plainly until this option is offered, then takes it. */
function take(run: Run, optionId: string): PlayerView {
  let view = run.view();
  for (;;) {
    const wanted = view.choices.find(
      (c) => "optionId" in c && c.optionId === optionId,
    );
    if (wanted) return run.choose(wanted);
    if (view.choices.length === 0) throw new Error(`No "${optionId}".`);
    view = run.choose(plainChoice(view));
  }
}

/** Plays plainly on, until the player is told of the Plan being done. */
function untilDone(run: Run): PlayerView {
  let view = run.view();
  while (view.step.kind !== "notice" || view.step.title !== DONE) {
    view = run.choose(plainChoice(view));
  }
  return view;
}

function seedWhereBossIs(kind: Kind): number {
  const seed = SEEDS.find(
    (s) =>
      readHiddenTruth(newRun(s)).characters.find((c) => c.id === "boss")
        ?.kind === kind,
  );
  if (seed === undefined) throw new Error(`No seed deals a ${kind} boss.`);
  return seed;
}

const risksOf = (run: Run) => readHiddenTruth(run).risks.map((r) => r.id);

/** Who can be asked for the real figures, one of whom really has them. */
const FIGURES = ["analyst", "admin", "projects"];
const askFor = (character: string) => `ask-${character}-for-figures`;
const keeperOf = (run: Run) => readHiddenTruth(run).plans[0]?.keeper ?? "";
const howItEnded = (run: Run) => readHiddenTruth(run).plans[0]?.ended?.how;

/** Every option offered in a run played plainly to its end. */
function offeredInPlainRun(seed: number): Set<string> {
  const run = newRun(seed);
  const offered = new Set<string>();
  for (let view = run.view(); view.choices.length > 0;) {
    for (const c of view.choices) if ("optionId" in c) offered.add(c.optionId);
    view = run.choose(plainChoice(view));
  }
  return offered;
}

describe("the game's Grand Plans", { timeout: 60_000 }, () => {
  it("is heard of in the first meeting, whichever kind the boss is", () => {
    for (const kind of KINDS) {
      const run = newRun(seedWhereBossIs(kind));
      expect(run.view().grandPlan).toBeNull();

      const meeting = take(run, "say-nothing");

      expect(meeting.grandPlan).toMatchObject({
        title: "One tool for everything",
        status: "To be done by the end of month 6",
      });
    }
  });

  it("can be completed in appearance in month 4, whichever kind the boss is, and adds a hidden risk", () => {
    for (const kind of KINDS) {
      const run = newRun(seedWhereBossIs(kind));
      playToMonth(run, "4");
      take(run, "fake");

      const done = untilDone(run);

      // How the boss took it is a sign written for their kind.
      expect(done.step.kind === "notice" && done.step.reaction).toBeTruthy();
      expect(done.grandPlan?.status).toBe("Completed");
      expect(risksOf(run)).toContain("tool-hollow");
    }
  });

  it("can be completed in reality only with the figures from whoever really has them", () => {
    for (const kind of KINDS) {
      const run = newRun(seedWhereBossIs(kind));
      playToMonth(run, "4");
      take(run, "deliver");
      take(run, askFor(keeperOf(run)));
      take(run, "load-the-real-figures");

      const done = untilDone(run);

      expect(done.grandPlan?.status).toBe("Completed");
      expect(done.month).toBe(5);
      expect(howItEnded(run)).toBe("reality");
      expect(risksOf(run)).not.toContain("tool-hollow");
    }
  });

  it("is only made to look done with figures from anyone else, and adds the risk", () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const run = newRun(seed);
      playToMonth(run, "4");
      take(run, "deliver");
      const someoneElse = FIGURES.find((c) => c !== keeperOf(run)) ?? "";
      take(run, askFor(someoneElse));
      take(run, "load-the-real-figures");

      const done = untilDone(run);

      expect(done.step).toMatchObject({
        body: expect.stringContaining("not the real ones") as unknown,
      });
      expect(howItEnded(run)).toBe("appearance");
      expect(risksOf(run)).toContain("tool-hollow");
    }
  });

  it("shows who has the figures at month 2's meeting, and who that is goes by the deal", () => {
    const keepers = new Set<string>();
    for (const seed of SEEDS.slice(0, 30)) {
      const run = newRun(seed);
      const view = take(run, "say-nothing");
      const keeper = keeperOf(run);
      keepers.add(keeper);
      let meeting = view;
      while (
        meeting.step.kind !== "scene" ||
        meeting.step.id !== "lessons-learned"
      ) {
        meeting = run.choose(plainChoice(meeting));
      }
      const called = gameContent.characters.find(
        (c) => c.id === keeper,
      )?.called;
      const sign = everySign(meeting.step).find(
        (s) => s.label === "Who has the figures",
      );

      expect(sign?.text.toLowerCase()).toContain(called?.toLowerCase());
    }
    expect(keepers).toEqual(new Set(FIGURES));
  });

  it("pleases an Incompetent boss and not a Believer with the same completion", () => {
    const shift = (kind: Kind) => {
      const run = newRun(seedWhereBossIs(kind));
      let view = playToMonth(run, "4");
      while (view.step.kind !== "notification" || view.step.id !== "new-tool") {
        view = run.choose(plainChoice(view));
      }
      const before = readHiddenTruth(run).bossBelief;
      take(run, "fake");
      return readHiddenTruth(run).bossBelief - before;
    };

    expect(shift("incompetent")).toBeGreaterThan(0);
    expect(shift("believer")).toBeLessThan(0);
  });

  it("offers the real way only to a player who started rolling the tool out", () => {
    const offered = offeredInPlainRun(1);

    expect(offered.has("screenshot-on-the-note")).toBe(true);
    expect(offered.has("load-the-real-figures")).toBe(false);
    expect(offered.has("show-the-tool-live")).toBe(false);
  });

  it("is blamed on a player who handed it off on some deals, and never on one who asked in writing", () => {
    const blamedFor = (answer: string) =>
      SEEDS.slice(0, 40).filter((seed) => {
        const run = newRun(seed);
        playToMonth(run, "4");
        take(run, answer);
        for (let view = run.view(); view.month < 8;) {
          // Blamed on you, it offers Escapes. Blamed on someone else, it
          // arrives as a Move, without your name.
          const told = [view.step, ...landedIn(view)];
          if (
            told.some(
              (s) =>
                (s.kind === "move" || s.kind === "escape") &&
                s.title === "Lessons from the new tool" &&
                s.body.includes("your name"),
            )
          ) {
            return true;
          }
          if (view.choices.length === 0) return false;
          view = run.choose(plainChoice(view));
        }
        return false;
      });

    expect(blamedFor("hand-off").length).toBeGreaterThan(0);
    expect(blamedFor("push-back")).toEqual([]);
  });

  it("brings a new Plan with a new boss, which can be done in appearance", () => {
    const first = newRun(1);
    playToMonth(first, "2");
    const saved = JSON.parse(first.save()) as {
      state: { reportsTo: Record<string, string> };
    };
    // The Office Co-ordinator answers to your boss's boss, who stays above them.
    saved.state.reportsTo.you = "admin";
    const run = resumeRun({
      save: JSON.stringify(saved),
      content: gameContent,
    });

    take(run, "take-the-labels-off");
    const done = untilDone(run);

    expect(done.month).toBe(3);
    expect(done.grandPlan?.title).toBe("Hot-desking");
    expect(risksOf(run)).toContain("desks-hollow");
  });

  it("has your boss take on Hot-desking once One tool for everything has ended", () => {
    const run = newRun(1);
    playToMonth(run, "4");
    take(run, "fake");
    untilDone(run);

    const view = take(run, "being-phased");

    expect(view.month).toBe(5);
    expect(view.grandPlan?.title).toBe("Hot-desking");
    expect(readHiddenTruth(run).plans.map((p) => p.id)).toEqual([
      "one-tool",
      "hot-desks",
    ]);
  });
});

// Kept true for the Grand Plans section of docs/playtest.md.
describe("the Grand Plan playtest's seeds", { timeout: 60_000 }, () => {
  const bossOn = (seed: number) =>
    readHiddenTruth(newRun(seed)).characters.find((c) => c.id === "boss")?.kind;
  /** Your boss's belief, from just before month 4's Demand to the Plan being done. */
  const shiftFrom = (seed: number, ...options: string[]) => {
    const run = newRun(seed);
    let view = playToMonth(run, "4");
    while (view.step.kind !== "notification" || view.step.id !== "new-tool") {
      view = run.choose(plainChoice(view));
    }
    const before = readHiddenTruth(run).bossBelief;
    for (const option of options) {
      take(run, option === "ask" ? askFor(keeperOf(run)) : option);
    }
    untilDone(run);
    return { shift: readHiddenTruth(run).bossBelief - before, run };
  };

  it("keeps seed 106 a Believer boss whom faking it puts off", () => {
    expect(bossOn(106)).toBe("believer");
    expect(shiftFrom(106, "fake").shift).toBeLessThan(0);
  });

  it("keeps seed 283 an Incompetent boss whom faking it delights", () => {
    expect(bossOn(283)).toBe("incompetent");
    expect(shiftFrom(283, "fake").shift).toBeGreaterThan(0);
  });

  it("keeps seed 37 a Practitioner boss who would rather launch it themselves", () => {
    expect(bossOn(37)).toBe("practitioner");
    const theirs = shiftFrom(37, "deliver", "ask", "launch-it-as-theirs");
    const yours = shiftFrom(37, "deliver", "ask", "load-the-real-figures");

    expect(howItEnded(theirs.run)).toBe("reality");
    expect(theirs.shift).toBeGreaterThan(0);
    expect(theirs.shift).toBeGreaterThan(yours.shift);
  });
});

// Kept true for "hear of a Grand Plan and complete it" in tests/e2e/grand-plan.spec.ts.
describe("the Grand Plan browser test's seed", () => {
  it("keeps seed 1 hearing of it in month 1, and faking it in month 4", () => {
    const run = newRun(1);
    const view = playToMonth(run, "4");
    expect(view.grandPlan?.title).toBe("One tool for everything");

    const answered = take(run, "fake");
    const choice: Choice | undefined = answered.choices[0];

    expect(answered.month).toBe(4);
    expect(choice?.type).toBe("continue");
    expect(untilDone(run).grandPlan?.status).toBe("Completed");
  });
});
