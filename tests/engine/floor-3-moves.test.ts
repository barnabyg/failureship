import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import type { PlayerView } from "../../src/engine";
import { isOn } from "../../src/engine/floors";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { withoutSeatEvents } from "./fixture";
import { CLEAN, playAll, playRun } from "./real-runs";

/** The bigger Moves only a Middle manager has, as Scene or Notification and option. */
const FLOOR_3_MOVES = [
  "the-board/give-a-number",
  "the-board/take-it-offline",
  "the-board/blame-the-analyst",
  "cost-challenge/cut-the-checks",
  "cost-challenge/pass-the-cut-down",
  "cost-challenge/move-the-costs",
  "offsite-brief/team-writes-it",
  "offsite-brief/last-years-offsite",
];

/** Floor 2's Grand Plan done for real: seed 2 is a Middle manager from month 12. */
const TO_FLOOR_3 = `${CLEAN},staff-the-centre`;

/** Without the Company Events that open a seat, so that a stay runs to the end. */
const staying = withoutSeatEvents(gameContent);

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

/** The month a Bill or Move with this id or title reached the player, on Floor 3. */
function arrived(views: readonly PlayerView[], idOrTitle: string) {
  return views.find(
    (v) =>
      v.job.id === "middle-manager" &&
      ((v.step.kind === "notification" && v.step.id === idOrTitle) ||
        (v.step.kind === "escape" &&
          (v.step.id === idOrTitle || v.step.title === idOrTitle)) ||
        (v.step.kind === "move" && v.step.title === idOrTitle) ||
        (v.step.kind === "notice" && v.step.title === idOrTitle)),
  )?.month;
}

/**
 * Plays the real game, seat events and all, on seed `seed` to Floor 3, takes
 * the Move, and reads what came of it.
 */
function taking(seed: number, move: string) {
  const { run, views, took } = playRun(seed, `${TO_FLOOR_3},${move}`);
  const truth = readHiddenTruth(run);
  const risk = (id: string) => truth.risks.find((r) => r.id === id)?.cameOut;
  const kept = (character: string, about: string) =>
    truth.memories.some((m) => m.character === character && m.about === about);
  return { views, taken: took.get(move) ?? Infinity, risk, kept };
}

describe("Floor 3's bigger Moves", () => {
  it("are not on offer on the floors below", () => {
    for (const seed of [1, 2, 3, 8, 13, 16, 24]) {
      const views = playAll(seed, CLEAN, staying);
      const below = [
        ...offeredOn(views, "junior-employee"),
        ...offeredOn(views, "team-lead"),
      ];

      for (const move of FLOOR_3_MOVES) {
        expect(below, `${move} on seed ${String(seed)}`).not.toContain(move);
      }
    }
  });

  it("are all on offer to a Middle manager", () => {
    const offered = offeredOn(
      playAll(2, TO_FLOOR_3, staying),
      "middle-manager",
    );

    for (const move of FLOOR_3_MOVES) expect(offered, move).toContain(move);
  });
});

describe("the longest stay on Floor 3", () => {
  // Floor 2 can start in month 4, and its seat fall vacant then, to be decided
  // as month 6 closes: so Floor 3 can start in month 7, a stay of twelve.
  const openFor = gameContent.vacancies?.seats[0]?.openFor ?? 0;
  const LONGEST = gameContent.balance.monthsPerRun - 2 * (1 + openFor + 1) + 2;
  const own = <T extends { floor?: string | undefined }>(items: readonly T[]) =>
    items.filter((i) => i.floor === "middle-manager");
  const scenes = own(gameContent.scenes);
  const notifications = own(gameContent.notifications);
  const actions = own(gameContent.actions);

  it("is twelve months", () => {
    expect(LONGEST).toBe(12);
  });

  it("holds a meeting of its own, with a choice in it, every month, and no Scene twice", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const held: string[] = [];
      for (let month = 1; month <= LONGEST; month++) {
        const where = {
          seed,
          job: "middle-manager",
          monthsOnFloor: { "middle-manager": month },
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
        expect(
          notifications.filter((n) => isOn(where, gameContent, n)).length,
          owner,
        ).toBeGreaterThan(0);
        held.push(...on.map((s) => s.id));
      }
      expect(new Set(held).size, `seed ${String(seed)}`).toBe(LONGEST);
    }
  });
});

// These deals reach Floor 3 in month 12, with the Company Events that open
// seats, so that it is the real game. Its first three months are the run's
// months 12 to 14. Each Move comes back before the run ends, through a hidden
// risk that lands on the player, a Thread, or what someone remembers of it.
describe("what comes back of them, within the run", () => {
  const { monthsPerRun } = gameContent.balance;
  /** Whether a Bill came after the Move and before the run ended. */
  const inTime = (taken: number, back: number | undefined) =>
    back !== undefined && back > taken && back <= monthsPerRun;

  it("brings back the checks cut for the Chief Financial Officer: the Service Delivery Lead, and the incident", () => {
    const { views, taken, risk, kept } = taking(24, "cut-the-checks");

    expect(taken).toBe(12);
    expect(kept("delivery", "cut-their-checks")).toBe(true);
    expect(risk("checks-cut")).toMatchObject({ onPlayer: true });
    expect(
      inTime(taken, arrived(views, "Incident review: why it happened")),
    ).toBe(true);
  });

  it("leaves the checks elsewhere once they are put back", () => {
    const { risk } = taking(24, "cut-the-checks,put-the-checks-back");

    expect(risk("checks-cut")).toMatchObject({ onPlayer: false });
  });

  it("brings back the cut passed down to your team, through those who lost by it", () => {
    const { views, taken, kept } = taking(28, "pass-the-cut-down");

    expect(kept("analyst", "cut-passed-down")).toBe(true);
    expect(kept("projects", "cut-passed-down")).toBe(true);
    const back = [
      arrived(views, "Seventy per cent"),
      arrived(views, "Self-directed learning"),
    ].find((m) => m !== undefined);
    expect(inTime(taken, back)).toBe(true);
  });

  it("brings back the costs moved downstairs, through the Office Co-ordinator's reconciliation", () => {
    const { views, taken, risk } = taking(37, "move-the-costs");

    expect(risk("costs-downstairs")).toMatchObject({ onPlayer: true });
    expect(inTime(taken, arrived(views, "costs-found"))).toBe(true);
  });

  it("brings back the cut put in writing, as an example", () => {
    const { views, taken } = taking(24, "ask-what-stops");

    expect(inTime(taken, arrived(views, "The two pages"))).toBe(true);
  });

  it("brings back the offsite deck your team wrote overnight, through the Junior Associate", () => {
    const { views, taken, kept } = taking(24, "team-writes-it");

    expect(taken).toBe(13);
    expect(kept("associate", "wrote-it-overnight")).toBe(true);
    expect(inTime(taken, arrived(views, "Out of office"))).toBe(true);
  });

  it("brings back last year's offsite deck, through your boss's boss", () => {
    const { views, taken, risk } = taking(28, "last-years-offsite");

    expect(risk("offsite-recycled")).toMatchObject({ onPlayer: true });
    expect(inTime(taken, arrived(views, "Last year's offsite"))).toBe(true);
  });

  it("brings back a figure made up for the Board: the Senior Analyst, and the minutes", () => {
    const { views, taken, risk } = taking(24, "give-a-number");

    expect(taken).toBe(14);
    expect(risk("board-number")).toMatchObject({ onPlayer: true });
    expect(inTime(taken, arrived(views, "board-number-landed"))).toBe(true);
  });

  it("leaves a figure made up for the Board elsewhere once the minutes are corrected", () => {
    const { risk } = taking(24, "give-a-number,correct-the-minutes");

    expect(risk("board-number")).toMatchObject({ onPlayer: false });
  });

  it("brings back a question taken offline, as item one", () => {
    const { views, taken } = taking(24, "take-it-offline");

    expect(arrived(views, "board-offline-chased")).toBe(taken + 1);
  });

  it("brings back an answer the Board was promised by Friday", () => {
    const { views, taken } = taking(24, "say-you-will-find-out");

    expect(inTime(taken, arrived(views, "Friday"))).toBe(true);
  });

  it("brings back a figure put down to the Senior Analyst, with its workings", () => {
    const { views, taken, kept } = taking(24, "blame-the-analyst");

    expect(kept("analyst", "blamed-at-the-board")).toBe(true);
    expect(inTime(taken, arrived(views, "The workings"))).toBe(true);
  });
});

describe("the tricky question at the Board", () => {
  // Deals that reach Floor 3 in month 12, and its Board in month 15.
  const REACHING = [2, 24, 28, 30, 37, 41, 42, 43, 54, 66, 68, 71];

  it("is asked by someone competing with the player, and listed against them only if they are a Rival", () => {
    const asked = { rival: 0, other: 0 };
    for (const seed of REACHING) {
      const { run, views } = playRun(seed, TO_FLOOR_3, { content: staying });
      const board = views.find(
        (v) => v.step.kind === "scene" && v.step.id === "the-board",
      );
      if (board?.step.kind !== "scene") throw new Error("No Board.");
      // Your boss, or someone who answers to your boss beside you.
      const boss = board.orgChart.find((e) => e.title.endsWith(", your boss"));
      const peers = board.orgChart.filter(
        (e) => e.reportsTo === boss?.name && e.name !== "You",
      );
      const competing = ["your boss", ...peers.map((e) => `the ${e.title}`)];
      const told = board.step.narration.join(" ").toLowerCase();
      expect(
        competing.some((who) => told.includes(`${who.toLowerCase()} asks`)),
        `seed ${String(seed)}`,
      ).toBe(true);

      const byRival = readHiddenTruth(run).rivals.filter((r) =>
        r.did.some((d) => d.move === "the-board"),
      );
      const results = views.at(-1)?.step;
      if (results?.kind !== "results") throw new Error("No results.");
      const listed = results.rivals.filter((r) =>
        r.did.some(
          (d) => d.text === "A particularly tricky question, at the Board",
        ),
      );
      expect(listed).toHaveLength(byRival.length);
      if (byRival.length > 0) asked.rival += 1;
      else asked.other += 1;
    }

    expect(asked.rival).toBeGreaterThan(0);
    expect(asked.other).toBeGreaterThan(0);
  });
});

describe("One Roadmap's cover, apart from the Cost Challenge", () => {
  // A Budget Move at the Cost Challenge is not asking in writing what stops,
  // so with the Roadmap left alone its failure is blamed on the player on
  // these seeds. Asking in reply to the welcome e-mail covers it instead.
  const blamed = (views: readonly PlayerView[]) =>
    views.some(
      (v) =>
        (v.step.kind === "move" || v.step.kind === "escape") &&
        v.step.body.includes("middle-management"),
    );

  it.each([24, 28, 37])(
    "keeps seed %i out of the blame after a Budget Move",
    (seed) => {
      const exposed = playAll(seed, `${TO_FLOOR_3},cut-the-checks`);
      const covered = playAll(
        seed,
        `${TO_FLOOR_3},ask-what-the-plan-stops,cut-the-checks`,
      );

      expect(blamed(exposed)).toBe(true);
      expect(blamed(covered)).toBe(false);
      expect(covered.some((v) => v.job.id === "middle-manager")).toBe(true);
      expect(covered.at(-1)?.job.id).toBe("middle-manager");
    },
  );
});
