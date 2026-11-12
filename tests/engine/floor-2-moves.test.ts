import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun, type PlayerView } from "../../src/engine";
import { isOn } from "../../src/engine/floors";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice, playToMonth } from "../../src/ui/later-month";
import { withoutSeatEvents } from "./fixture";
import { CLEAN, playAll, playRun } from "./real-runs";

/** The bigger Moves only a Team lead has, as Scene or Notification and option. */
const FLOOR_2_MOVES = [
  "team-hire/hire-your-friend",
  "transformation-budget/hire-the-consultant",
  "pay-review/pot-to-your-allies",
  "floor-plan/move-the-critic",
  "floor-plan/split-the-pair",
];

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

/** The month a Bill or Move with this id or title reached the player, on Floor 2. */
function arrived(views: readonly PlayerView[], idOrTitle: string) {
  return views.find(
    (v) =>
      v.job.id === "team-lead" &&
      ((v.step.kind === "notification" && v.step.id === idOrTitle) ||
        (v.step.kind === "escape" &&
          (v.step.id === idOrTitle || v.step.title === idOrTitle)) ||
        (v.step.kind === "move" && v.step.title === idOrTitle)),
  )?.month;
}

/** Plays seed `seed` to Floor 2 and takes the Move, and reads what came of it. */
function taking(seed: number, move: string) {
  const { run, views, took } = playRun(seed, `${CLEAN},${move}`);
  const truth = readHiddenTruth(run);
  const risk = (id: string) => truth.risks.find((r) => r.id === id)?.cameOut;
  const kept = (character: string, about: string) =>
    truth.memories.some((m) => m.character === character && m.about === about);
  return { views, taken: took.get(move) ?? Infinity, risk, kept };
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
    const offered = offeredOn(playAll(2, CLEAN), "team-lead");

    for (const move of FLOOR_2_MOVES) expect(offered, move).toContain(move);
  });
});

// Floor 2's fourth month is the run's month 11 on these deals, which reach it
// in month 8. Each Move comes back through a hidden risk that lands on the
// player, and through what someone remembers of it.
describe("what comes back of them, later on Floor 2", () => {
  it("brings back an old friend you hired: your Believer boss, and the Senior Analyst doing their work", () => {
    // On seed 16 your boss on Floor 2 is a Believer.
    const { views, taken, risk, kept } = taking(16, "hire-your-friend");

    expect(kept("analyst", "hired-a-friend")).toBe(true);
    expect(arrived(views, "friend-boss-furious")).toBeGreaterThan(taken);
    expect(risk("friend-out-of-depth")).toMatchObject({ onPlayer: true });
    expect(arrived(views, "Who has been doing what")).toBeGreaterThan(taken);
  });

  it("brings back the consultant: the invoice, and the Senior Analyst's own spreadsheet", () => {
    const { views, taken, risk, kept } = taking(12, "hire-the-consultant");

    expect(kept("analyst", "consultant-took-my-work")).toBe(true);
    expect(arrived(views, "Version history")).toBeGreaterThan(taken);
    expect(risk("consultant-invoice")).toMatchObject({ onPlayer: true });
    expect(arrived(views, "consultant-invoice-landed")).toBeGreaterThan(taken);
  });

  it("brings back the bonus pot you gave your allies: the one left out, and their letter", () => {
    const { views, taken, risk, kept } = taking(17, "pot-to-your-allies");

    expect(kept("analyst", "left-out-of-the-pot")).toBe(true);
    expect(arrived(views, "Open to opportunities")).toBeGreaterThan(taken);
    expect(risk("bonus-letters")).toMatchObject({ onPlayer: true });
    expect(arrived(views, "bonus-letters-landed")).toBeGreaterThan(taken);
  });

  it("brings back the desk by the lift: the one you moved, and the fire door", () => {
    const { views, taken, risk, kept } = taking(12, "move-the-critic");

    expect(kept("projects", "moved-by-the-lift")).toBe(true);
    expect(arrived(views, "Good morning")).toBeGreaterThan(taken);
    expect(risk("fire-door-desk")).toMatchObject({ onPlayer: true });
    expect(arrived(views, "fire-door-desk-landed")).toBeGreaterThan(taken);
  });
});

describe("the bonus pot given to your allies", () => {
  const team = ["analyst", "projects"];
  const { warmAt } = gameContent.reputation?.mood ?? { warmAt: 1 };

  it("goes to whoever really backs you, and leaves out only those who do not", () => {
    const leftOut = new Set<string>();
    for (const seed of [2, 12, 16, 17, 24, 28, 30, 34, 37]) {
      const run = startRun({ seed, content: gameContent });
      let view = playToMonth(run, "12", CLEAN);
      const isPot = (v: PlayerView) =>
        v.step.kind === "scene" && v.step.id === "pay-review";
      while (!isPot(view)) view = run.choose(plainChoice(view));
      const before = readHiddenTruth(run);
      const backs = team.filter(
        (c) =>
          (before.beliefs[c] ?? 0) >= warmAt ||
          before.powerMap.favours.some((f) => f.owes === "you" && f.to === c),
      );
      run.choose({
        type: "scene",
        sceneId: "pay-review",
        optionId: "pot-to-your-allies",
      });
      const after = readHiddenTruth(run).memories.filter(
        (m) => m.about === "left-out-of-the-pot",
      );
      const out = after.map((m) => m.character);

      for (const c of team) {
        expect(out.includes(c), `${c} on seed ${String(seed)}`).toBe(
          !backs.includes(c),
        );
        if (out.includes(c)) leftOut.add(c);
      }
    }
    // Not the same person left out on every deal.
    expect(leftOut).toEqual(new Set(team));
  });
});

describe("the longest stay on Floor 2", () => {
  // A seat falls vacant in month 1 at the earliest, is open from the month after
  // for `openFor` months, and is decided as the last of them closes. So with two
  // months open, Floor 2 can start in month 4: a stay of up to fifteen months.
  const openFor = gameContent.vacancies?.seats[0]?.openFor ?? 0;
  const LONGEST = gameContent.balance.monthsPerRun - (1 + openFor + 1) + 1;
  const own = <T extends { floor?: string | undefined }>(items: readonly T[]) =>
    items.filter((i) => i.floor === "team-lead");
  const scenes = own(gameContent.scenes);
  const actions = own(gameContent.actions);

  it("is fifteen months", () => {
    expect(LONGEST).toBe(15);
  });

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
