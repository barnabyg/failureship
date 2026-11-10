import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  KINDS,
  startRun,
  type Content,
  type Kind,
  type PlayerView,
} from "../../src/engine";
import type { State } from "../../src/engine/state";
import { calledBy } from "../../src/engine/say";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { writtenMonths } from "../../src/engine/floors";
import { withoutSeatEvents } from "./fixture";

/**
 * Walks a whole run, with a pick made from what is on offer at each step. At
 * each Scene it notes whom each Character is called, as things stand.
 */
function walk(
  seed: number,
  pickFrom: (view: PlayerView, turn: number) => PlayerView["choices"][number],
  content: Content = gameContent,
) {
  const run = startRun({ seed, content });
  const views = [run.view()];
  const named = new Map<PlayerView, Map<string, string>>();
  let view = views[0] as PlayerView;
  for (let turn = 0; view.choices.length > 0; turn++) {
    view = run.choose(pickFrom(view, turn));
    views.push(view);
    if (view.step.kind === "scene") {
      const { state } = JSON.parse(run.save()) as { state: State };
      named.set(
        view,
        new Map(
          content.characters.map((c) => [
            calledBy(state, content, c.id).toLowerCase(),
            c.id,
          ]),
        ),
      );
    }
  }
  return { run, views, named };
}

const stayingPut = withoutSeatEvents(gameContent);

/** Answers for nothing, so as to keep an action for the meeting room, and goes. */
function attendsEverything(view: PlayerView, turn: number) {
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
  const meeting = view.choices.find(
    (c) => c.type === "action" && c.actionId.startsWith("meeting"),
  );
  const choice = meeting ?? view.choices[turn % view.choices.length];
  if (!choice) throw new Error("No choice.");
  return choice;
}

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
  it("always says what the player can do, on every seed and pick", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { views } = walk(seed, (view, turn) => {
        const choice =
          view.choices[(seed * 7 + turn * 3) % view.choices.length];
        if (!choice) throw new Error("No choice.");
        return choice;
      });

      for (const view of views) {
        expect(view.hint.trim()).not.toBe("");
        expect(JSON.stringify(view)).not.toMatch(
          /\{(holder|ignored|bystander|subject|who|name|fact|source|said)\}/,
        );
      }
      expect(views.at(-1)?.step.kind).toBe("results");
    }
  });

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
  // Half the seeds move each average below by under 0.01. Their thin limit is
  // `perfect`, at 0.36 against 0.40, and that is about the limit and not the count.
  const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

  /** The kind a careful reader would guess from the signs seen in a run. */
  function readerGuesses(
    views: readonly PlayerView[],
    named: ReadonlyMap<PlayerView, ReadonlyMap<string, string>>,
  ) {
    const { kinds } = gameContent.hiddenTruth;
    const total = Object.values(kinds).reduce((sum, k) => sum + k.weight, 0);
    const belief = new Map<string, Record<Kind, number>>();
    for (const c of gameContent.characters) {
      belief.set(c.id, {
        believer: Math.log(kinds.believer.weight / total),
        incompetent: Math.log(kinds.incompetent.weight / total),
        practitioner: Math.log(kinds.practitioner.weight / total),
      });
    }
    for (const view of views) {
      if (view.step.kind !== "scene") continue;
      for (const { who, text } of view.step.behaviours) {
        const written = gameContent.behaviours.find(
          (b) =>
            b.text.replaceAll("{who}", who).toLowerCase() ===
            text.toLowerCase(),
        );
        // Whoever is called this now, which follows a place or a seat's title.
        const id = named.get(view)?.get(who.toLowerCase());
        const shownBy = gameContent.characters.find((c) => c.id === id);
        const held = belief.get(shownBy?.id ?? "");
        // A whistleblower's own signs say nothing of the kind they were dealt.
        const whistled = gameContent.changing?.whistleblower.signs.some(
          (s) =>
            s.text.replaceAll("{who}", who).toLowerCase() ===
            text.toLowerCase(),
        );
        if (whistled) continue;
        if (!written || !held) throw new Error(`Unknown sign: ${text}`);
        const role = shownBy?.role;
        const open = gameContent.behaviours.filter(
          (b) => role !== undefined && (b.roles?.includes(role) ?? true),
        );
        for (const kind of KINDS) {
          const sum = open.reduce((all, b) => all + b.likelihood[kind], 0);
          // A sign that one kind could never show still leaves room for doubt.
          held[kind] += Math.log(
            Math.max(written.likelihood[kind], 0.25) / sum,
          );
        }
      }
    }
    return belief;
  }

  /** Over many seeds: how often the reader is right, and how often a guess is. */
  function accuracy() {
    let right = 0;
    let everyoneRight = 0;
    let people = 0;
    const counts: Record<Kind, number> = {
      believer: 0,
      incompetent: 0,
      practitioner: 0,
    };
    for (const seed of SEEDS) {
      const { run, views, named } = walk(seed, attendsEverything);
      const belief = readerGuesses(views, named);
      const truth = readHiddenTruth(run).characters;
      let allRight = true;
      for (const dealt of truth) {
        const held = belief.get(dealt.id);
        if (!held) throw new Error("Nobody with that id.");
        const guess = KINDS.reduce((a, b) => (held[b] > held[a] ? b : a));
        counts[dealt.kind] += 1;
        people += 1;
        if (guess === dealt.kind) right += 1;
        else allRight = false;
      }
      if (allRight) everyoneRight += 1;
    }
    return {
      reading: right / people,
      guessing: Math.max(...Object.values(counts)) / people,
      perfect: everyoneRight / SEEDS.length,
    };
  }

  // Two hundred runs of eighteen months take most of a minute.
  it("rewards a careful reader, without ever making them certain", () => {
    const { reading, guessing, perfect } = accuracy();

    // This reader knows the exact likelihoods, so a person will do worse.
    expect(reading).toBeGreaterThan(guessing + 0.15);
    expect(reading).toBeLessThan(0.85);
    expect(perfect).toBeLessThan(0.4);
  }, 120_000);

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
