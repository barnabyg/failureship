import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
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
import { emptyMonthRaw } from "./fixture";

function raw() {
  const base = emptyMonthRaw();
  return {
    ...base,
    balance: { ...base.balance, monthsPerRun: 4 },
    notifications: [
      {
        id: "start",
        from: "Someone",
        subject: "START",
        body: "Start it, or not.",
        months: [1],
        options: [
          { id: "nothing", label: "Do nothing" },
          { id: "start-it", label: "Start it", sets: ["started"] },
        ],
      },
    ],
    threads: [
      {
        id: "comes-back",
        startedBy: "started",
        chance: 1,
        after: { min: 2, max: 2 },
        started: "STARTED",
        outcomes: [
          {
            playedOut: "PLAYED-OUT",
            bill: {
              id: "bill",
              as: "notice",
              title: "BILL",
              body: "It came back.",
            },
            gauges: [{ gauge: "teflon", by: 25, note: "MOVED-BY-THE-THREAD" }],
          },
        ],
      },
    ],
    gauges: [
      {
        id: "teflon",
        label: "TEFLON",
        start: 50,
        min: 0,
        max: 100,
        milestones: [
          { at: 70, title: "SLIPPERY", body: "You earned SLIPPERY." },
        ],
      },
    ],
  };
}

const choose = (optionId: string): Choice => ({
  type: "notification",
  notificationId: "start",
  optionId,
});

function playOut(run: Run): PlayerView[] {
  const views = [run.view()];
  for (;;) {
    const next = views.at(-1)?.choices[0];
    if (!next) return views;
    views.push(run.choose(next));
  }
}

const teflon = (view: PlayerView) =>
  view.gauges.find((g) => g.id === "teflon")?.value;

describe("a Gauge", () => {
  it("is in view at every step of the run", () => {
    const run = startRun({ seed: 1, content: parseContent(raw()) });
    run.choose(choose("start-it"));

    for (const view of playOut(run)) {
      expect(teflon(view)).toBeTypeOf("number");
    }
  });

  it("moves only when a Thread plays out, and says which, as the month closes", () => {
    const content = parseContent(raw());
    const still = startRun({ seed: 1, content });
    still.choose(choose("nothing"));
    const moved = startRun({ seed: 1, content });
    moved.choose(choose("start-it"));

    for (const view of playOut(still)) expect(teflon(view)).toBe(50);
    const views = playOut(moved);
    const story = views.find(
      (v) => v.step.kind === "story" && teflon(v) === 75,
    );
    expect(story?.month).toBe(3);
    expect(views.filter((v) => v.month < 3).map(teflon)).not.toContain(75);
    if (story?.step.kind !== "story") throw new Error("No story.");
    expect(story.step.gauges.join(" ")).toContain("MOVED-BY-THE-THREAD");
    expect(story.gauges[0]?.moves).toEqual([
      { month: 3, by: 25, note: "MOVED-BY-THE-THREAD" },
    ]);
  });

  it("earns a Milestone at its level, which the player is told and the results show", () => {
    const run = startRun({ seed: 1, content: parseContent(raw()) });
    run.choose(choose("start-it"));
    const views = playOut(run);

    expect(
      views.some(
        (v) => v.step.kind === "notice" && v.step.title === "SLIPPERY",
      ),
    ).toBe(true);
    const end = views.at(-1)?.step;
    if (end?.kind !== "results") throw new Error("No results.");
    expect(end.milestones).toEqual([{ month: 3, title: "SLIPPERY" }]);
  });

  it("ends the same on deals with different Power Maps when the same Threads play out", () => {
    const content = parseContent(raw());
    const maps = new Set<string>();
    const values = new Set<number | undefined>();
    for (let seed = 0; seed < 30; seed++) {
      const run = startRun({ seed, content });
      maps.add(JSON.stringify(readHiddenTruth(run).powerMap));
      run.choose(choose("start-it"));
      values.add(teflon(playOut(run).at(-1) ?? run.view()));
    }

    expect(maps.size).toBeGreaterThan(5);
    expect([...values]).toEqual([75]);
  });

  it("is refused with a Milestone it can never reach", () => {
    const broken = raw();
    const [gauge] = broken.gauges;
    if (gauge) gauge.milestones = [{ at: 120, title: "NEVER", body: "Never." }];

    expect(() => parseContent(broken)).toThrow(/out of reach/);
  });
});

describe("nothing in the rules but Milestones", () => {
  it("reads a Gauge", () => {
    const folder = path.join(import.meta.dirname, "../../src/engine");
    const readers = readdirSync(folder).filter((file) =>
      /state\.gauges\b|\.gauges\[|gaugeMoves/.test(
        readFileSync(path.join(folder, file), "utf8"),
      ),
    );

    expect(readers).toEqual(["gauges.ts", "state.ts"]);
  });
});

describe("the real Gauges", () => {
  it("are Teflon and Fawning, one of which every Thread's ending moves", () => {
    expect(gameContent.gauges?.map((g) => g.id)).toEqual(["teflon", "fawning"]);
    for (const thread of gameContent.threads) {
      for (const outcome of thread.outcomes) {
        expect(outcome.gauges.length, thread.id).toBeGreaterThan(0);
      }
    }
  });
});
