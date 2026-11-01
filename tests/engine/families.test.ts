import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  MOVE_FAMILIES,
  startRun,
  type Choice,
  type PlayerView,
} from "../../src/engine";
import { everyNotification } from "../../src/engine/content";

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const notifications = everyNotification(gameContent);

/** Which family a legal choice belongs to, read from the data files. */
function familyOf(choice: Choice) {
  if (choice.type === "action") {
    return gameContent.actions.find((a) => a.id === choice.actionId)?.family;
  }
  if (choice.type === "notification") {
    return notifications
      .find((n) => n.id === choice.notificationId)
      ?.options.find((o) => o.id === choice.optionId)?.family;
  }
  if (choice.type === "scene") {
    return gameContent.scenes
      .find((s) => s.id === choice.sceneId)
      ?.options.find((o) => o.id === choice.optionId)?.family;
  }
  return undefined;
}

/** Plays a run, always taking a family it has not yet tried if one is on offer. */
function tryEverything(seed: number) {
  const run = startRun({ seed, content: gameContent });
  const seen = new Set<string>();
  const views: PlayerView[] = [run.view()];
  let view = run.view();
  while (view.choices.length > 0) {
    const fresh = view.choices.find((c) => {
      const family = familyOf(c);
      return family !== undefined && !seen.has(family);
    });
    const next = fresh ?? view.choices[0];
    if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
    const family = familyOf(next);
    if (family) seen.add(family);
    view = run.choose(next);
    views.push(view);
  }
  return { seen, views };
}

describe("the Move families", () => {
  it("has at least two different choices in every family", () => {
    const open = [
      ...gameContent.actions.map((a) => a.family),
      ...notifications.flatMap((n) => n.options.map((o) => o.family)),
      ...gameContent.scenes.flatMap((s) =>
        s.options
          .filter((o) => o.about === undefined && o.requires === undefined)
          .map((o) => o.family),
      ),
    ];
    for (const family of MOVE_FAMILIES) {
      expect(open.filter((f) => f === family).length, family).toBeGreaterThan(
        1,
      );
    }
  });

  it("tags every choice that the boss would notice", () => {
    for (const n of notifications) {
      for (const o of n.options) {
        if (o.approach) expect(o.family, `${n.id} ${o.id}`).toBeDefined();
      }
    }
    for (const s of gameContent.scenes) {
      for (const o of s.options) {
        if (o.results.some((r) => r.approach)) {
          expect(o.family, `${s.id} ${o.id}`).toBeDefined();
        }
      }
    }
    for (const a of gameContent.actions) {
      if (a.approach) expect(a.family, a.id).toBeDefined();
    }
  });

  it("can reach every family in a run, on any seed", () => {
    for (const seed of SEEDS) {
      const { seen } = tryEverything(seed);

      expect(seen, `seed ${String(seed)}`).toEqual(new Set(MOVE_FAMILIES));
    }
  });

  it("names no family until the results screen", () => {
    const labels = Object.values(gameContent.families ?? {}).map(
      (f) => f.label,
    );
    const shown = new RegExp(`\\b(${labels.join("|")})\\b`);
    expect(labels).toHaveLength(MOVE_FAMILIES.length);
    for (const seed of SEEDS.slice(0, 10)) {
      for (const view of tryEverything(seed).views) {
        if (view.step.kind === "results") continue;
        const seen = JSON.stringify(view);
        expect(seen).not.toMatch(shown);
        expect(seen).not.toContain("family");
      }
    }
  });

  it("shows on the results screen how the player played, by family", () => {
    const { views, seen } = tryEverything(5);
    const last = views.at(-1);
    if (last?.step.kind !== "results") throw new Error(last?.step.kind);
    const { played } = last.step;

    expect(played.map((p) => p.family)).toEqual(
      Object.values(gameContent.families ?? {}).map((f) => f.label),
    );
    expect(played.filter((p) => p.count > 0)).toHaveLength(seen.size);
    for (const row of played) expect(row.note.trim()).not.toBe("");
  });

  it("counts each choice once, under its own family", () => {
    const run = startRun({ seed: 1, content: gameContent });
    run.choose({
      type: "notification",
      notificationId: "pub-invite",
      optionId: "decline",
    });
    run.choose({ type: "continue" });
    run.choose({
      type: "notification",
      notificationId: "monthly-report",
      optionId: "lie",
    });
    run.choose({ type: "continue" });
    run.choose({ type: "action", actionId: "work" });
    run.choose({ type: "continue" });
    let view = run.view();
    while (view.choices.length > 0) {
      const { step } = view;
      const free =
        step.kind === "notification"
          ? step.options.find((o) => o.id === "meets" || o.id === "excuse")
          : undefined;
      const next: Choice | undefined =
        step.kind === "notification" && free
          ? {
              type: "notification",
              notificationId: step.id,
              optionId: free.id,
            }
          : view.choices.find((c) => familyOf(c) === undefined);
      view = run.choose(next ?? (view.choices[0] as Choice));
    }
    if (view.step.kind !== "results") throw new Error(view.step.kind);
    const count = (label: string) =>
      view.step.kind === "results"
        ? view.step.played.find((p) => p.family === label)?.count
        : undefined;

    expect(count("Fabricate")).toBeGreaterThanOrEqual(1);
    expect(count("Deliver")).toBeGreaterThanOrEqual(1);
  });
});

describe("the longer run", () => {
  it("lasts nine months, with Annual Calibration last", () => {
    const calibration = gameContent.scenes.find((s) => s.id === "calibration");

    expect(gameContent.balance.monthsPerRun).toBe(9);
    expect(calibration?.months).toEqual([9]);
  });

  it("gives each new month a Scene, a Notification and an official story", () => {
    for (const month of [6, 7, 8]) {
      const on = (item: { months?: number[] | undefined }) =>
        item.months?.includes(month);
      expect(gameContent.scenes.filter(on), String(month)).toHaveLength(1);
      expect(gameContent.notifications.filter(on).length).toBeGreaterThan(0);
      expect(
        gameContent.officialStory.entries.filter(on).length,
      ).toBeGreaterThan(0);
    }
  });
});
