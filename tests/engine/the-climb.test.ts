import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  startRun,
  type Choice,
  type Content,
  type PlayerView,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice } from "../../src/ui/later-month";
import { withoutSeatEvents } from "./fixture";
import { CLEAN, playRun } from "./real-runs";

/**
 * Floor 2's Grand Plan done for real in its second month, and Floor 3's in its
 * own: on seed 2 that wins three seats, as months 7, 11 and 15 close.
 */
export const CLIMB = `${CLEAN},staff-the-centre,decide-what-stops`;

/** Rings the Speak Up line about your boss, in month 8, which gets rid of them on some deals. */
const REPORT = "ring-about-your-boss";

/** Asks the Senior Analyst for the figures in month 5, and really loads them: every Plan for real. */
const HONEST = "take-the-blame,ask-analyst-for-figures,load-the-real-figures";

/** Getting rid of your boss on Floor 2, by Internal Audit, and on Floor 3, upstairs. */
const GET_RID = ["audit-your-boss", "nominate-your-boss"];

/** What a player who means to climb does for real on Floors 2 and 3, whenever it is offered. */
const FOR_REAL = [
  "staff-the-centre",
  "staff-it-now",
  "decide-what-stops",
  "stop-one-programme",
  "tie-it-to-the-roadmap",
  "ask-what-stops",
  "check-the-pack",
  "book-the-desks",
];

/** The same player's word about each open seat, with whoever is above their boss. */
const FOR_THE_SEAT = [
  "word-with-the-head",
  "word-with-the-programme-manager",
  "word-with-transformation",
];

/** What a player who fakes every Grand Plan does instead. */
const FOR_SHOW = [
  "sign-on-a-door",
  "report-the-centre-open",
  "lanyards",
  "hang-the-sign",
  "draw-swimlanes",
  "fill-the-template",
  "add-a-swimlane",
  "roadmap-as-a-lesson",
];

/**
 * A scripted player who knows the game but not the deal: takes each of `once`
 * in order, the first time it is offered, then each of `always` whenever it
 * is offered, and plays plainly otherwise.
 */
function climb(
  seed: number,
  once: string,
  always: readonly string[],
  content: Content,
) {
  const run = startRun({ seed, content });
  let view = run.view();
  const views: PlayerView[] = [view];
  const first = once.split(",");
  while (view.choices.length > 0) {
    const offered = (wanted: (id: string) => boolean) =>
      view.choices.find((c) => "optionId" in c && wanted(c.optionId));
    const next = offered((id) => id === first[0]);
    if (next) first.shift();
    const choice: Choice =
      next ?? offered((id) => always.includes(id)) ?? plainChoice(view);
    view = run.choose(choice);
    views.push(view);
  }
  return { views, truth: readHiddenTruth(run) };
}

/**
 * Of 200 deals, which this player wins, and by which route up, seat by seat:
 * how each seat fell vacant, or `ousted` where the player got rid of its
 * holder. Without the Company Events that open seats, the routes are only
 * what the player did.
 */
function survey(once: string, always: readonly string[]) {
  const content = withoutSeatEvents(gameContent);
  const routes = new Map<string, number[]>();
  for (let seed = 1; seed <= 200; seed++) {
    const { views, truth } = climb(seed, once, always, content);
    const end = views.at(-1)?.step;
    if (end?.kind !== "results" || !end.ending.won) continue;
    const route = truth.vacancies
      .filter((v) => v.decided?.winner === "you")
      .map((v) => (v.ousted ? "ousted" : v.way))
      .join(" > ");
    routes.set(route, [...(routes.get(route) ?? []), seed]);
  }
  const wins = [...routes.values()].flat().length;
  return { wins, routes };
}

describe("the climb to the top of Floor 3", () => {
  it("can be won by a scripted run, and the results screen says how", () => {
    const { views } = playRun(2, CLIMB);
    const results = views.at(-1)?.step;
    if (results?.kind !== "results") throw new Error("No results.");
    const won = views.findIndex((v) => v.step.kind === "win");

    expect(views[won]?.month).toBe(15);
    expect(views[won]?.job.id).toBe("middle-manager");
    expect(views[won - 1]?.step).toMatchObject({
      kind: "notice",
      title: "Congratulations: the top of Floor 3",
    });
    expect(views.slice(won + 1).map((v) => v.step.kind)).toEqual(["results"]);
    expect(results.title).toBe("You have reached the top of Floor 3");
    expect(results.ending).toMatchObject({ fired: false, won: true });
    expect(results.ending.text).toContain("month 15");
    expect(results.route.map((r) => r.text)).toEqual([
      "Month 7: Team lead, when Dennis Prowse's Grand Plan was done for show, and Dennis Prowse moved up anyway.",
      "Month 11: Middle manager, when Hugh Lamb's Grand Plan was really done, and Hugh Lamb moved up.",
      "Month 15: the top of Floor 3, when Gwen Ashdown's Grand Plan was really done, and Gwen Ashdown moved up.",
    ]);
  });

  // CLIMB fakes Floor 1's Plan. Seed 67 gets rid of both bosses above Floor 1.
  it("tells a stand-in for winning that goes by how the player got there", () => {
    const standIn = (views: readonly PlayerView[]) => {
      const step = views.find((v) => v.step.kind === "win")?.step;
      return step?.kind === "win" ? step.lines.join(" ") : "";
    };
    const forShow = standIn(playRun(2, CLIMB).views);
    const gotRid = standIn(
      climb(67, CLEAN, [...GET_RID, ...FOR_THE_SEAT], gameContent).views,
    );

    expect(forShow).toContain("a sign on a door");
    expect(gotRid).toContain("got rid of their friends");
  });

  it("rides the lift to Floor 3, to its own bosses, and its own rooms", () => {
    const { views } = playRun(2, CLIMB);
    const floor3 = views.find((v) => v.job.id === "middle-manager");
    const places = new Set(floor3?.hotspots.map((h) => h.place));

    expect(floor3?.month).toBe(12);
    expect(floor3?.job.title).toBe("Middle manager");
    expect(floor3?.orgChart).toContainEqual({
      name: "Gwen Ashdown",
      title: "Programme Manager, your boss",
      reportsTo: "Simone Fairley",
    });
    expect(floor3?.orgChart).toContainEqual({
      name: "Simone Fairley",
      title: "Head of Transformation, your boss's boss",
      reportsTo: null,
    });
    expect(places).toContain("steering-room");
    expect(places).not.toContain("team-room");
    // Nobody of Floor 3 is met before it.
    const below = views.filter((v) => v.job.id !== "middle-manager");
    expect(
      below.some((v) => v.orgChart.some((e) => e.name === "Simone Fairley")),
    ).toBe(false);
  });

  it("ends a run that is not won as before: at the end, or when fired", () => {
    const plain = playRun(8).views.at(-1)?.step;
    const fired = playRun(
      2,
      `${CLEAN},blame-your-analyst,report-the-analyst`,
    ).views.at(-1)?.step;

    expect(plain).toMatchObject({ kind: "results", ending: { won: false } });
    expect(fired).toMatchObject({
      kind: "results",
      ending: { fired: true, won: false },
    });
  });

  // A seat falls vacant in a month at the earliest, so the climb is a race
  // against eighteen months, which a player who knows the game wins on some
  // deals and not others. Doing the Plans and getting rid of bosses are
  // different routes up, each the player's own doing, on every floor. Getting
  // rid of them is the riskier, and faking every Plan wins far less.
  it(
    "is reachable within the run by different ways of playing, and much less often for show",
    { timeout: 300_000 },
    () => {
      const planner = survey(CLEAN, [...FOR_REAL, ...FOR_THE_SEAT]);
      const honest = survey(HONEST, [...FOR_REAL, ...FOR_THE_SEAT]);
      const ridder = survey(CLEAN, [...GET_RID, ...FOR_THE_SEAT]);
      const engineer = survey(`take-the-blame,${REPORT}`, [
        ...GET_RID,
        ...FOR_THE_SEAT,
      ]);
      const forShow = survey(CLEAN, [...FOR_SHOW, ...FOR_THE_SEAT]);

      expect(planner.wins).toBeGreaterThanOrEqual(30);
      expect(planner.wins).toBeLessThanOrEqual(80);
      expect([...planner.routes.keys()]).toEqual(["plan > plan > plan"]);
      expect(honest.wins).toBeGreaterThanOrEqual(15);
      expect(
        ridder.routes.get("plan > ousted > ousted")?.length,
      ).toBeGreaterThan(0);
      for (const route of ridder.routes.keys())
        expect(route).toMatch(/ousted$/);
      expect(
        engineer.routes.get("ousted > ousted > ousted")?.length,
      ).toBeGreaterThan(0);
      expect(forShow.wins).toBeLessThanOrEqual(planner.wins / 2);
    },
  );
});

describe("a big mistake at the top of Floor 3", () => {
  // On seed 2 the Senior Analyst has a dangerous Hidden Fact, and Floor 3's
  // seat is open from month 14, after its Plan is done in month 13.
  it("demotes seed 2 to Floor 2, under whoever came next for its seat, and out of the running for the one above", () => {
    const { run, views } = playRun(2, `${CLIMB},analyst-bottom-left`);
    const demoted = views.find(
      (v) =>
        v.step.kind === "notice" &&
        v.step.title === "A sideways move, downwards",
    );
    const after = views.find((v) => v.month === 15);
    const results = views.at(-1)?.step;
    if (results?.kind !== "results") throw new Error("No results.");
    const top = readHiddenTruth(run).vacancies.find(
      (v) => v.seat === "programme-manager",
    );

    expect(demoted?.month).toBe(15);
    expect(after?.job).toEqual({ id: "team-lead", title: "Team lead" });
    expect(after?.hotspots.map((h) => h.place)).toContain("team-room");
    expect(views.some((v) => v.step.kind === "win")).toBe(false);
    expect(top?.decided?.winner).toBe("analyst");
    // Nobody tells them who has the seat they were out of the running for.
    // Whoever took their own seat is their boss, under whoever has it.
    expect(
      views.some(
        (v) =>
          v.step.kind === "notice" &&
          v.step.title.startsWith("Congratulations to"),
      ),
    ).toBe(false);
    expect(views.at(-1)?.orgChart).toContainEqual({
      name: "Callum Reed",
      title: "Head of Operations, your boss",
      reportsTo: "Priya Venn",
    });
    expect(results.ending.won).toBe(false);
    expect(results.route.map((r) => r.text)).toEqual([
      expect.stringMatching(/^Month 7: Team lead/),
      expect.stringMatching(/^Month 11: Middle manager/),
      "Month 14: back down to Team lead, after an incident.",
    ]);
  });
});
