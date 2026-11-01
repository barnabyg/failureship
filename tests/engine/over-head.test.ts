import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";

const SEEDS = Array.from({ length: 400 }, (_, i) => i + 1);
const GO: Choice = { type: "action", actionId: "over-head" };

/** Answers for nothing, until the player is free to act. */
function toFloor(run: Run): PlayerView {
  let view = run.view();
  while (view.step.kind !== "actions") {
    const { step } = view;
    const free =
      step.kind === "notification"
        ? step.options.find((o) => o.costLabel === "Costs nothing")
        : undefined;
    const next: Choice | undefined =
      step.kind === "notification" && free
        ? { type: "notification", notificationId: step.id, optionId: free.id }
        : view.choices[0];
    if (!next) throw new Error(`Stuck at ${step.kind}.`);
    view = run.choose(next);
  }
  return view;
}

function kindOf(run: Run, who: string) {
  return readHiddenTruth(run).characters.find((c) => c.id === who)?.kind;
}

function isInfluential(run: Run) {
  const { order } = readHiddenTruth(run).powerMap;
  return order.indexOf("head") < gameContent.sources.influentialCount;
}

interface Attempt {
  seed: number;
  headKind: string;
  influential: boolean;
  bossKind: string;
  headShift: number;
  bossShift: number;
  caught: boolean;
}

/** One trip upstairs in month 1, and what it did to both opinions. */
function attempt(seed: number): Attempt {
  const run = startRun({ seed, content: gameContent });
  toFloor(run);
  const before = readHiddenTruth(run);
  let view = run.choose(GO);
  const titles = [];
  while (view.step.kind === "notice") {
    titles.push(view.step.title);
    view = run.choose({ type: "continue" });
  }
  const after = readHiddenTruth(run);
  const caughtTitle = gameContent.overHead?.findsOut.title;
  return {
    seed,
    headKind: kindOf(run, "head") ?? "",
    influential: isInfluential(run),
    bossKind: kindOf(run, "boss") ?? "",
    headShift: after.headOpinion - before.headOpinion,
    bossShift: after.bossOpinion - before.bossOpinion,
    caught: titles.includes(caughtTitle ?? ""),
  };
}

/** What the ordinary choices can do to the boss's opinion, at their extremes. */
function ordinaryExtremes() {
  const shifts = gameContent.boss.approaches.flatMap((a) =>
    Object.values(a.shift),
  );
  return { best: Math.max(...shifts), worst: Math.min(...shifts) };
}

const attempts = SEEDS.map(attempt);

describe("going over your boss's head", () => {
  it("is on the floor in every month", () => {
    const run = startRun({ seed: 1, content: gameContent });
    const view = toFloor(run);

    expect(view.choices).toContainEqual(GO);
    expect(
      gameContent.actions.find((a) => a.id === "over-head")?.months,
    ).toBeUndefined();
  });

  it("pays off more than any ordinary choice when it works", () => {
    const { best } = ordinaryExtremes();
    const good = attempts.filter((a) => a.headShift > 0 && !a.caught);
    const paying = good.filter((a) => a.influential);

    expect(paying.length).toBeGreaterThan(0);
    for (const a of paying) expect(a.bossShift).toBeGreaterThan(best);
  });

  it("costs more than any ordinary choice when your boss finds out", () => {
    const { worst } = ordinaryExtremes();
    const caught = attempts.filter((a) => a.caught && a.headShift <= 0);

    expect(caught.length).toBeGreaterThan(0);
    for (const a of caught) expect(a.bossShift).toBeLessThan(worst);
  });

  it("does not always work, and is not always found out", () => {
    expect(new Set(attempts.map((a) => a.headShift > 0))).toEqual(
      new Set([true, false]),
    );
    expect(new Set(attempts.map((a) => a.caught))).toEqual(
      new Set([true, false]),
    );
  });

  it("depends on the kind of your boss's boss", () => {
    const rate = (kind: string) => {
      const of = attempts.filter((a) => a.headKind === kind);
      return of.filter((a) => a.headShift > 0).length / of.length;
    };

    expect(rate("believer")).toBeGreaterThan(rate("practitioner"));
  });

  it("achieves less if they have little influence on the Power Map", () => {
    const worked = attempts.filter((a) => a.headShift > 0 && !a.caught);
    const shift = (influential: boolean) =>
      worked.find((a) => a.influential === influential)?.bossShift ?? NaN;

    expect(shift(true)).toBeGreaterThan(shift(false));
  });

  it("is found out more often by a boss who watches for it", () => {
    const rate = (kind: string) => {
      const of = attempts.filter((a) => a.bossKind === kind);
      return of.filter((a) => a.caught).length / of.length;
    };

    expect(rate("practitioner")).toBeGreaterThan(rate("incompetent"));
  });

  it("is the same every time on the same seed", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      expect(attempt(seed)).toEqual(attempt(seed));
    }
  });

  it("is not simply the best action every month", () => {
    const finalOpinion = (seed: number, climbs: boolean) => {
      const run = startRun({ seed, content: gameContent });
      let view = run.view();
      while (view.step.kind !== "results") {
        const { step } = view;
        const free =
          step.kind === "notification"
            ? step.options.find((o) => o.costLabel === "Costs nothing")
            : undefined;
        const climb =
          climbs &&
          view.choices.some((c) => JSON.stringify(c) === JSON.stringify(GO));
        const ordinary = view.choices.find(
          (c) => c.type !== "action" || c.actionId === "kitchen",
        );
        const next: Choice | undefined =
          step.kind === "notification" && free
            ? {
                type: "notification",
                notificationId: step.id,
                optionId: free.id,
              }
            : climb
              ? GO
              : (ordinary ?? view.choices[0]);
        if (!next) throw new Error(`Stuck at ${step.kind}.`);
        view = run.choose(next);
      }
      return readHiddenTruth(run).bossOpinion;
    };
    const mean = (climbs: boolean) =>
      SEEDS.slice(0, 150).reduce((sum, s) => sum + finalOpinion(s, climbs), 0) /
      150;

    expect(mean(true)).toBeLessThan(mean(false));
  }, 30_000);

  it("never shows either opinion or kind before the run ends", () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const run = startRun({ seed, content: gameContent });
      let view = run.view();
      let turn = 0;
      while (view.step.kind !== "results") {
        const seen = JSON.stringify(view);
        expect(seen).not.toMatch(/opinion/i);
        expect(seen).not.toMatch(/Believer|Incompetent|Practitioner/);
        const climb = view.choices.find(
          (c) => c.type === "action" && c.actionId === "over-head",
        );
        const next = climb ?? view.choices[turn++ % view.choices.length];
        if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
        view = run.choose(next);
      }
    }
  });

  it("shows how your boss's boss treats you, in any Scene they are in", () => {
    const signs = gameContent.overHead?.signs.map((s) => s.text) ?? [];
    const run = startRun({ seed: 1, content: gameContent });
    toFloor(run);
    const { step } = run.choose({ type: "action", actionId: "meeting" });
    if (step.kind !== "scene") throw new Error(step.kind);

    expect(signs).toContain(step.headTreatment);
  });

  it("shifts those signs as their opinion of you shifts", () => {
    const signText = (mood: "warm" | "cold") =>
      new Set(
        gameContent.overHead?.signs
          .filter((s) => s.likelihood[mood] > s.likelihood.neutral)
          .map((s) => s.text),
      );
    const shown = (wantWarm: boolean) => {
      const seen: string[] = [];
      for (const a of attempts) {
        if (wantWarm ? a.headShift <= 0 : a.headShift >= 0) continue;
        const run = startRun({ seed: a.seed, content: gameContent });
        toFloor(run);
        let view = run.choose(GO);
        while (view.month === 1) {
          const next = view.choices[0];
          if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
          view = run.choose(next);
        }
        view = toFloor(run);
        const meeting = view.choices.find(
          (c) => c.type === "action" && c.actionId.startsWith("meeting"),
        );
        if (!meeting) continue;
        const { step } = run.choose(meeting);
        if (step.kind === "scene" && step.headTreatment) {
          seen.push(step.headTreatment);
        }
      }
      return seen;
    };
    const share = (seen: string[], written: Set<string | undefined>) =>
      seen.filter((s) => written.has(s)).length / seen.length;

    expect(share(shown(true), signText("warm"))).toBeGreaterThan(
      share(shown(false), signText("warm")),
    );
  });

  it("says on the results screen what they really made of you", () => {
    const run = startRun({ seed: 3, content: gameContent });
    let view = run.view();
    while (view.choices.length > 0) {
      const next = view.choices[0];
      if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
      view = run.choose(next);
    }
    if (view.step.kind !== "results") throw new Error(view.step.kind);
    const { head } = view.step.boss;
    const { verdict } = gameContent.overHead ?? {};

    expect(head?.name).toBe("Hugh Lamb");
    expect(Object.values(verdict ?? {})).toContain(head?.verdict);
    expect(["Believer", "Incompetent", "Practitioner"]).toContain(head?.kind);
    expect(JSON.stringify(head)).not.toMatch(/-?\b\d+\b/);
  });

  it("refuses writing that names a kind", () => {
    const raw = structuredClone(gameContent);
    if (!raw.overHead) throw new Error("No over-head content.");
    raw.overHead.outcomes.believer.failed = ["A true Believer, plainly."];

    expect(() => parseContent(raw)).toThrow(/names a kind/);
  });

  it("refuses a sign that would settle their opinion", () => {
    const raw = structuredClone(gameContent);
    const sign = raw.overHead?.signs[0];
    if (!sign) throw new Error("No sign.");
    sign.likelihood = { warm: 1, neutral: 0, cold: 0 };

    expect(() => parseContent(raw)).toThrow(/only one opinion/);
  });
});
