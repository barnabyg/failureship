import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  startRun,
  type Choice,
  type Kind,
  type PlayerView,
} from "../../src/engine";
import { everyNotification } from "../../src/engine/content";
import { readHiddenTruth } from "../../src/engine/hidden-truth";

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
const notifications = everyNotification(gameContent);
const costOf = (key: string | undefined) =>
  key === undefined ? 0 : (gameContent.balance.actionCosts[key] ?? 0);

/** How a player tends to come across, best liked first. */
const STYLES = {
  straight: ["truth", "results", "plain-report", "push-back", "late-answer"],
  showy: ["theatre", "flatter", "blame"],
  useful: ["flatter", "favour", "cronyism", "hand-off", "ownership"],
} as const;
type Style = keyof typeof STYLES;

function approachesOf(choice: Choice): (string | undefined)[] {
  if (choice.type === "notification") {
    const option = notifications
      .find((n) => n.id === choice.notificationId)
      ?.options.find((o) => o.id === choice.optionId);
    return [option?.approach];
  }
  if (choice.type === "scene") {
    const option = gameContent.scenes
      .find((s) => s.id === choice.sceneId)
      ?.options.find((o) => o.id === choice.optionId);
    return option?.results.map((r) => r.approach) ?? [];
  }
  return [];
}

function rank(choice: Choice, style: Style): number {
  const liked: readonly string[] = STYLES[style];
  const places = approachesOf(choice)
    .map((a) => liked.indexOf(a ?? ""))
    .filter((p) => p >= 0);
  return places.length > 0 ? Math.min(...places) : liked.length;
}

/** Plays a whole run in one style, going to every meeting. */
function playIn(seed: number, style: Style) {
  const run = startRun({ seed, content: gameContent });
  let view = run.view();
  while (view.choices.length > 0) {
    const meeting = view.choices.find(
      (c) => c.type === "action" && c.actionId.startsWith("meeting"),
    );
    const floor = view.choices.find(
      (c) =>
        c.type === "action" &&
        c.actionId === (style === "straight" ? "work" : "kitchen"),
    );
    const best = [...view.choices].sort(
      (a, b) => rank(a, style) - rank(b, style),
    )[0];
    const next =
      view.step.kind === "actions" ? (meeting ?? floor ?? best) : best;
    if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(next);
  }
  return readHiddenTruth(run);
}

function meanOpinions(kind: Kind) {
  const seeds = SEEDS.filter(
    (s) =>
      readHiddenTruth(
        startRun({ seed: s, content: gameContent }),
      ).characters.find((c) => c.id === "boss")?.kind === kind,
  ).slice(0, 60);
  const mean = (style: Style) =>
    seeds.reduce((sum, s) => sum + playIn(s, style).bossOpinion, 0) /
    seeds.length;
  return {
    straight: mean("straight"),
    showy: mean("showy"),
    useful: mean("useful"),
  };
}

/** What a dutiful player has left on the floor, month by month. */
function floorActions(seed: number, dutiful: boolean) {
  const run = startRun({ seed, content: gameContent });
  const left: { month: number; remaining: number; open: number }[] = [];
  let view: PlayerView = run.view();
  let seenMonth = 0;
  while (view.choices.length > 0) {
    const { step } = view;
    if (step.kind === "actions" && view.month !== seenMonth) {
      seenMonth = view.month;
      left.push({
        month: view.month,
        remaining: view.actions.remaining,
        open: view.choices.length,
      });
    }
    const options = step.kind === "notification" ? step.options : [];
    const costed = options.find(
      (o) => o.affordable && o.costLabel !== "Costs nothing",
    );
    const free = options.find((o) => o.costLabel === "Costs nothing");
    const answer = dutiful ? (costed ?? free) : free;
    // A dutiful player explains a red Project once, by telling the truth.
    const truthful = view.choices.find(
      (c) => c.type === "scene" && c.optionId === "tell-the-truth",
    );
    const next: Choice | undefined =
      step.kind === "notification" && answer
        ? { type: "notification", notificationId: step.id, optionId: answer.id }
        : (truthful ?? view.choices[0]);
    if (!next) throw new Error(`Stuck at ${step.kind}.`);
    view = run.choose(next);
  }
  return left;
}

describe(
  "the approach has to change with the boss",
  { timeout: 60_000 },
  () => {
    it("rewards a straight approach most with a Believer", () => {
      const { straight, showy } = meanOpinions("believer");

      expect(straight).toBeGreaterThan(showy + 5);
    });

    it("rewards a showy approach most with an Incompetent", () => {
      const { straight, showy } = meanOpinions("incompetent");

      expect(showy).toBeGreaterThan(straight + 5);
    });

    it("rewards being useful most with a Practitioner", () => {
      const { straight, useful } = meanOpinions("practitioner");

      expect(useful).toBeGreaterThan(straight + 5);
    });

    it("has no style that is best with every kind of boss", () => {
      const winner = (kind: Kind) => {
        const means = Object.entries(meanOpinions(kind));
        return means.sort((a, b) => b[1] - a[1])[0]?.[0];
      };

      expect(
        new Set([
          winner("believer"),
          winner("incompetent"),
          winner("practitioner"),
        ]).size,
      ).toBeGreaterThan(1);
    });
  },
);

describe("every month leaves a real choice", { timeout: 60_000 }, () => {
  it("offers something free on every Notification, so nothing is forced", () => {
    for (const n of notifications) {
      expect(
        n.options.some((o) => costOf(o.cost) === 0),
        n.id,
      ).toBe(true);
    }
  });

  it("lets a player who answers for nothing choose on the floor, every month", () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const months = floorActions(seed, false);

      expect(months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const { remaining, open } of months) {
        expect(remaining).toBeGreaterThanOrEqual(2);
        expect(open).toBeGreaterThanOrEqual(2);
      }
    }
  });

  // Reached by the balance data: at first it was fewer than one month in five.
  it("leaves even a dutiful player an action of their own in most months", () => {
    let months = 0;
    let free = 0;
    for (const seed of SEEDS.slice(0, 100)) {
      for (const { remaining, open } of floorActions(seed, true)) {
        months += 1;
        expect(open).toBeGreaterThanOrEqual(remaining > 0 ? 2 : 0);
        if (remaining > 0) free += 1;
      }
      // A month with nothing left never reaches the floor at all, so it counts too.
      months += 9 - floorActions(seed, true).length;
    }

    expect(free / months).toBeGreaterThan(0.6);
  });

  it("asks for at most one costly answer a month, beside the report", () => {
    const every = [
      ...gameContent.notifications,
      ...(gameContent.demands?.items ?? []),
    ];
    for (let m = 1; m <= gameContent.balance.monthsPerRun; m++) {
      const costly = every.filter(
        (n) =>
          n.months?.includes(m) && n.options.some((o) => costOf(o.cost) > 0),
      );

      expect(costly.length, `month ${String(m)}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("the boss's opinion stays worth reading", { timeout: 60_000 }, () => {
  it("is not settled in the first months, whatever the player does", () => {
    const { warmAt, coldAt } = gameContent.balance.opinion;
    const styles: Style[] = ["straight", "showy", "useful"];
    let runs = 0;
    let open = 0;
    for (const seed of SEEDS.slice(0, 60)) {
      for (const style of styles) {
        const run = startRun({ seed, content: gameContent });
        let view = run.view();
        while (view.month === 1) {
          const best = [...view.choices].sort(
            (a, b) => rank(a, style) - rank(b, style),
          )[0];
          if (!best) throw new Error(`Stuck at ${view.step.kind}.`);
          view = run.choose(best);
        }
        const { bossOpinion } = readHiddenTruth(run);
        runs += 1;
        if (bossOpinion < warmAt && bossOpinion > coldAt) open += 1;
      }
    }

    expect(open / runs).toBeGreaterThan(0.7);
  });
});
