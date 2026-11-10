import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { KINDS, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { writtenMonths } from "../../src/engine/floors";
import { withoutSeatEvents } from "./fixture";
import { attendsEverything, walk } from "./walk";

const stayingPut = withoutSeatEvents(gameContent);

/** Takes this option the first time it is offered, and otherwise picks as given. */
function takingOnce(
  optionId: string,
  pick: (view: PlayerView, turn: number) => PlayerView["choices"][number],
) {
  let taken = false;
  return (view: PlayerView, turn: number) => {
    const named = taken
      ? undefined
      : view.choices.find((c) => "optionId" in c && c.optionId === optionId);
    if (named) taken = true;
    return named ?? pick(view, turn);
  };
}

/** The same, but lasts the whole run: the first thing said in a meeting is safe. */
function lastsTheRun(view: PlayerView, turn: number) {
  return attendsEverything(view, view.step.kind === "scene" ? 0 : turn);
}

function resultsOf(view: PlayerView | undefined) {
  if (view?.step.kind !== "results") throw new Error(view?.step.kind);
  return view.step;
}

describe("months that do not feel like one month repeated", () => {
  it("gives every month a floor is written for its own Scene and Notifications", () => {
    const inMonth = (
      item: { floor?: string | undefined; months?: number[] | undefined },
      job: string,
      month: number,
    ) =>
      (item.floor === undefined || item.floor === job) &&
      (item.months?.includes(month) ?? false);
    const presented = gameContent.floors.flatMap(({ job }) =>
      Array.from({ length: writtenMonths(gameContent, job) }, (_, i) => {
        const month = i + 1;
        // The Project Status Review opens when flagged, so it belongs to no month.
        const scenes = gameContent.scenes
          .filter((s) => inMonth(s, job, month))
          .map((s) => s.id);
        // The Monthly Status Report recurs, so it is not what sets a month apart.
        const notifications = [
          ...gameContent.notifications,
          ...(gameContent.demands?.items ?? []),
        ]
          .filter((n) => inMonth(n, job, month))
          .map((n) => n.id);
        const owner = `${job} month ${String(month)}`;
        expect(scenes, owner).toHaveLength(1);
        expect(notifications.length, owner).toBeGreaterThan(0);
        return [...scenes, ...notifications];
      }),
    );

    const everything = presented.flat();
    expect(new Set(everything).size).toBe(everything.length);
  });

  it("opens a different Scene in each written month, a review each quarter, and the pool in turn", () => {
    // Seed 1 stays on Floor 1 when no Company Event opens a seat for it.
    const { views } = walk(1, lastsTheRun, stayingPut);
    expect(views.every((v) => v.job.id === "junior-employee")).toBe(true);
    const reviews = new Set(
      gameContent.scenes
        .filter((s) => s.quarter !== undefined)
        .map((s) => s.id),
    );
    const held = views.flatMap((v) =>
      v.step.kind === "scene" && v.step.id !== "red-project"
        ? [{ month: v.month, id: v.step.id, title: v.step.title }]
        : [],
    );
    const reviewed = held.filter((h) => reviews.has(h.id));
    const meetings = held.filter((h) => !reviews.has(h.id)).map((h) => h.title);

    // A review every third month, each its own.
    expect(reviewed.map((h) => h.month)).toEqual([3, 6, 9, 12, 15, 18]);
    expect(new Set(reviewed.map((h) => h.title)).size).toBe(6);
    // Nine written meetings, then Floor 1's pool, each before any comes again.
    const inPool = gameContent.scenes.filter(
      (s) => s.pool && s.floor === "junior-employee",
    ).length;
    expect(meetings).toHaveLength(18);
    expect(new Set(meetings.slice(0, 9)).size).toBe(9);
    const pooled = meetings.slice(9);
    const turn = pooled.slice(0, inPool);
    expect(new Set(turn).size).toBe(inPool);
    pooled.forEach((title, i) => {
      expect(title).toBe(turn[i % inPool]);
    });
  });

  // Every month differs on either floor, as in the nine-month run. Seed 2 is
  // promoted to Floor 2 in month 8, by faking the Plan in month 5. Seed 1
  // stays on Floor 1, with no Company Event to open a seat for it.
  const RUNS: [string, number][] = [
    ["seed 1, on Floor 1", 1],
    ["seed 2, promoted", 2],
  ];
  const pickOn = (seed: number) =>
    seed === 2
      ? takingOnce("screenshot-on-the-note", lastsTheRun)
      : lastsTheRun;

  it.each(RUNS)("lands a different Move every month: %s", (_, seed) => {
    // A Bill can land as a Move as well, beside the month's own.
    const written = new Set(gameContent.moves.map((m) => m.title));
    const { views } = walk(seed, pickOn(seed), stayingPut);
    const moves = views.flatMap((v) =>
      v.step.kind === "move" && written.has(v.step.title) ? [v.step.title] : [],
    );

    expect(moves).toHaveLength(gameContent.balance.monthsPerRun);
    expect(new Set(moves).size).toBe(moves.length);
  });

  it.each(RUNS)(
    "tells a different official story every month: %s",
    (_, seed) => {
      const { views } = walk(seed, pickOn(seed), stayingPut);
      const stories = views.flatMap((v) =>
        v.step.kind === "story"
          ? [JSON.stringify(v.step.pairs.map((p) => p.reported))]
          : [],
      );

      expect(views.at(-2)?.job.id).toBe(
        seed === 2 ? "team-lead" : "junior-employee",
      );
      expect(new Set(stories).size).toBe(gameContent.balance.monthsPerRun);
    },
  );

  it("gives you an action at any meeting you do not go to", () => {
    const { views } = walk(3, (view) => {
      const { step } = view;
      const free =
        step.kind === "notification"
          ? step.options.find((o) => o.costLabel === "Costs nothing")
          : undefined;
      if (step.kind === "notification" && free) {
        return {
          type: "notification" as const,
          notificationId: step.id,
          optionId: free.id,
        };
      }
      const choice = view.choices.find(
        (c) => !(c.type === "action" && c.actionId.startsWith("meeting")),
      );
      if (!choice) throw new Error("No choice.");
      return choice;
    });
    const written = gameContent.demands?.missed?.actions.map((a) => a.title);
    const told = views.flatMap((v) =>
      v.step.kind === "notice" && written?.includes(v.step.title)
        ? [v.step.title]
        : [],
    );

    expect(new Set(told).size).toBe(gameContent.balance.monthsPerRun);
  });

  it("never gives you those actions when you do go", () => {
    const { views } = walk(2, attendsEverything);
    const told = JSON.stringify(views.map((v) => v.step));

    expect(told).not.toContain("Apologies for absence");
  });

  it("names no particular month's meeting when a Scene is skipped", () => {
    const { views } = walk(1, (view, turn) => {
      const open = view.choices.filter(
        (c) => !(c.type === "action" && c.actionId.startsWith("meeting")),
      );
      const choice = open[turn % open.length];
      if (!choice) throw new Error("No choice.");
      return choice;
    });
    const reported = views.flatMap((v) =>
      v.step.kind === "story"
        ? v.step.pairs.flatMap((p) => p.reported ?? [])
        : [],
    );

    expect(reported.join()).toContain("this month's meeting");
    expect(reported.join()).not.toContain("Monthly Alignment");
  });

  it("reads differently at the same place in different months", () => {
    const told = new Set<string>();
    for (const action of ["kitchen", "one-to-one", "work"]) {
      const known = gameContent.actions.find((a) => a.id === action);
      told.add(known?.result?.body ?? "");
      for (const more of known?.moreResults ?? []) told.add(more.body);
    }

    expect(told.size).toBe(27);
  });
});

describe("the whole run", () => {
  // Whether it always says what the player can do, on many seeds, is in
  // tests/balance/steering.test.ts.

  it("deals visibly different runs from two seeds", () => {
    const seen = [1, 8].map((seed) => {
      const { run, views } = walk(seed, attendsEverything);
      return {
        deal: readHiddenTruth(run)
          .characters.map((c) => c.kind)
          .join(),
        results: JSON.stringify(resultsOf(views.at(-1)).characters),
      };
    });

    expect(seen[0]?.results).not.toEqual(seen[1]?.results);
  });
});

describe("the balance of the deal", () => {
  // How well a careful reader does is in tests/balance/steering.test.ts.
  it("leaves no sign that settles a kind on its own", () => {
    for (const b of gameContent.behaviours) {
      expect(
        KINDS.filter((k) => b.likelihood[k] > 0).length,
        b.id,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("the owner's data files", () => {
  it("has no game text written into the interface", () => {
    const folder = path.join(import.meta.dirname, "../../src/ui");
    for (const file of readdirSync(folder)) {
      if (!file.endsWith(".tsx")) continue;
      const code = readFileSync(path.join(folder, file), "utf8");
      // Words sitting between tags, or a label given as a literal.
      expect(code, file).not.toMatch(/>\s*[A-Za-z][a-z]+ [a-z]+[^<{]*</);
      expect(code, file).not.toMatch(/(title|label)="[^"]+"/);
    }
  });

  it("has enough of everything for a floor's written months", () => {
    expect(gameContent.scenes.length).toBeGreaterThanOrEqual(9);
    expect(gameContent.notifications.length).toBeGreaterThanOrEqual(9);
    expect(gameContent.moves.length).toBeGreaterThanOrEqual(10);
    expect(gameContent.buzzwords.length).toBeGreaterThanOrEqual(3);
  });
});
