import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  startRun,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice } from "../../src/ui/later-month";
import { isOn } from "../../src/engine/floors";
import { withoutSeatEvents } from "./fixture";

/**
 * On seed 2, taking the blame in month 2 keeps the record clean, and faking the
 * Plan at month 5's Ideas Workshop wins the seat: Floor 2 from month 8.
 */
const CLEAN = "take-the-blame,screenshot-on-the-note";

/** The bigger Moves only a Team lead has, as Scene or Notification and option. */
const FLOOR_2_MOVES = [
  "team-hire/hire-your-friend",
  "transformation-budget/hire-the-consultant",
  "seating-plan/move-the-critic",
  "team-bonus-pot/bonus-allies-only",
];

/**
 * Plays a whole run plainly, taking each option named, a comma-separated list,
 * once and in order, and keeps every view.
 */
function playAll(
  seed: number,
  choose: string | null,
  content: Content = gameContent,
): PlayerView[] {
  return play(seed, choose, content).views;
}

/** The same, keeping the run, for its hidden truth. */
function play(
  seed: number,
  choose: string | null,
  content: Content = gameContent,
): { run: Run; views: PlayerView[] } {
  const run = startRun({ seed, content });
  let view = run.view();
  const views = [view];
  const wanted = choose ? choose.split(",") : [];
  while (view.choices.length > 0) {
    const named = view.choices.find(
      (c) => "optionId" in c && c.optionId === wanted[0],
    );
    if (named) wanted.shift();
    view = run.choose(named ?? plainChoice(view));
    views.push(view);
  }
  expect(wanted).toEqual([]);
  return { run, views };
}

/** Every option offered on the given floor, as Scene or Notification and option. */
function offeredOn(views: readonly PlayerView[], job: string): Set<string> {
  return new Set(
    views.flatMap(({ job: { id }, step }) =>
      id === job && (step.kind === "scene" || step.kind === "notification")
        ? step.options.map((o) => `${step.id}/${o.id}`)
        : [],
    ),
  );
}

describe("Floor 2's bigger Moves", () => {
  it("are not on offer on Floor 1", () => {
    const staying = withoutSeatEvents(gameContent);
    for (const seed of [1, 3, 8, 13, 24]) {
      const views = playAll(seed, null, staying);
      expect(views.some((v) => v.job.id === "junior-employee")).toBe(true);
      const offered = offeredOn(views, "junior-employee");

      for (const move of FLOOR_2_MOVES) {
        expect(offered.has(move), `${move} on seed ${String(seed)}`).toBe(
          false,
        );
      }
    }
  });

  it("are all on offer to a Team lead", () => {
    const views = playAll(2, CLEAN);
    const offered = offeredOn(views, "team-lead");

    for (const move of FLOOR_2_MOVES) expect(offered, move).toContain(move);
  });
});

/** The month a Bill or Move with this id or title reached the player, on Floor 2. */
function arrived(views: readonly PlayerView[], idOrTitle: string) {
  return views.find(
    (v) =>
      v.job.id === "team-lead" &&
      ((v.step.kind === "notification" && v.step.id === idOrTitle) ||
        (v.step.kind === "move" && v.step.title === idOrTitle)),
  )?.month;
}

/** The month the player took this option. */
function tookIn(views: readonly PlayerView[], optionId: string) {
  const at = views.findIndex(
    (v) =>
      (v.step.kind === "scene" || v.step.kind === "notification") &&
      v.step.options.some((o) => o.id === optionId),
  );
  return views[at]?.month;
}

describe("what comes back of them, later on Floor 2", () => {
  // Floor 2 month 4 is the run's month 11 on these deals. On seed 16 your boss
  // on Floor 2 is a Believer, and on seed 2 a Practitioner.
  it("brings a Believer boss back furious that you hired an old friend", () => {
    const views = playAll(16, `${CLEAN},hire-your-friend`);
    const hired = tookIn(views, "hire-your-friend") ?? Infinity;

    expect(arrived(views, "friend-boss-furious")).toBeGreaterThan(hired);
  });

  it("brings your old friend's failure out through the Senior Analyst, who remembers", () => {
    const { run, views } = play(2, `${CLEAN},hire-your-friend`);
    const truth = readHiddenTruth(run);

    expect(truth.memories).toContainEqual(
      expect.objectContaining({
        character: "analyst",
        about: "hired-a-friend",
      }),
    );
    expect(truth.risks).toContainEqual(
      expect.objectContaining({
        id: "friend-out-of-depth",
        cameOut: expect.objectContaining({ onPlayer: true }) as unknown,
      }),
    );
    expect(arrived(views, "Who has been doing what")).toBeGreaterThan(11);
  });

  it("lets the Senior Analyst remember being passed over for your allies' bonus", () => {
    const { run, views } = play(2, `${CLEAN},bonus-allies-only`);
    const truth = readHiddenTruth(run);

    expect(truth.memories).toContainEqual(
      expect.objectContaining({ character: "analyst", about: "passed-over" }),
    );
    expect(truth.risks.map((r) => r.id)).toContain("bonus-grievance");
    expect(arrived(views, "Open to opportunities")).toBeGreaterThan(12);
  });

  it("adds the consultant's invoice to the hidden risks, and lets the boss be impressed", () => {
    const { run, views } = play(2, `${CLEAN},hire-the-consultant`);

    expect(readHiddenTruth(run).risks.map((r) => r.id)).toContain(
      "consultant-invoice",
    );
    const readout = views.find(
      (v) =>
        v.step.kind === "move" && v.step.title === "The consultant's readout",
    );
    expect(readout?.step.kind === "move" && readout.step.body).toContain(
      "Your boss would like to sponsor it",
    );
  });

  it("brings the desk by the lift back through the one you moved", () => {
    const views = playAll(2, `${CLEAN},move-the-critic`);

    expect(arrived(views, "Good morning")).toBeGreaterThan(12);
  });
});

describe("the longest stay on Floor 2", () => {
  // Floor 2 is reached in month 8 at the earliest, so a stay is at most eleven months.
  const LONGEST = gameContent.balance.monthsPerRun - 7;
  const own = <T extends { floor?: string | undefined }>(items: readonly T[]) =>
    items.filter((i) => i.floor === "team-lead");
  const scenes = own(gameContent.scenes);
  const actions = own(gameContent.actions);

  it("holds a meeting of its own, with a choice in it, every month, and no Scene twice", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const held: string[] = [];
      for (let month = 1; month <= LONGEST; month++) {
        const where = {
          seed,
          job: "team-lead",
          monthsOnFloor: { "team-lead": month },
        };
        const on = scenes.filter((s) => isOn(where, gameContent, s));
        const owner = `seed ${String(seed)} month ${String(month)}`;

        expect(on, owner).toHaveLength(1);
        for (const scene of on) {
          expect(scene.options.length, owner).toBeGreaterThanOrEqual(3);
          const opens = actions.filter(
            (a) => a.scene === scene.id && isOn(where, gameContent, a),
          );
          expect(opens, owner).toHaveLength(1);
        }
        held.push(...on.map((s) => s.id));
      }
      expect(new Set(held).size, `seed ${String(seed)}`).toBe(LONGEST);
    }
  });
});
