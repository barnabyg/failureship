import { describe, expect, it } from "vitest";
import { parseContent, startRun, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { playThrough, vacancyRaw } from "./vacancy-fixture";

const SEEDS = Array.from({ length: 80 }, (_, i) => i + 1);

/** The seat fixture, with Ana's seat the way out of the top floor. */
function winFixture() {
  const raw = vacancyRaw();
  const [seat] = raw.vacancies.seats;
  if (!seat) throw new Error("No seat.");
  const rest: Partial<typeof seat> = { ...seat };
  delete rest.job;
  return parseContent({
    ...raw,
    vacancies: {
      ...raw.vacancies,
      seats: [
        {
          ...rest,
          win: {
            title: "THE-STAND-IN",
            lines: ["THE-LIFT-GOES-NOWHERE", "A-VOUCHER"],
            reached: "THE-TOP",
            results: { title: "YOU-WON", intro: "HOW-YOU-WON" },
            ending: "WON-IN-{month}",
          },
        },
      ],
    },
  });
}

const content = winFixture();

function decidedOn(seed: number) {
  const run = startRun({ seed, content });
  const views = playThrough(run);
  const winner = readHiddenTruth(run).vacancies[0]?.decided?.winner;
  return { views, winner };
}

const kinds = (views: readonly PlayerView[]) => views.map((v) => v.step.kind);

describe("winning the way out of the top floor", () => {
  const won = SEEDS.map(decidedOn).filter((d) => d.winner === "you");
  const lost = SEEDS.map(decidedOn).filter((d) => d.winner !== "you");

  it("comes up on some deals and not on others", () => {
    expect(won.length).toBeGreaterThan(0);
    expect(lost.length).toBeGreaterThan(0);
  });

  it("ends the run as the seat is decided, with the decision, then the stand-in, then the results", () => {
    for (const { views } of won) {
      const steps = kinds(views);
      const win = steps.indexOf("win");

      expect(views.at(-1)?.month).toBe(3);
      expect(views[win - 1]?.step).toMatchObject({
        kind: "notice",
        title: "SEAT-WON",
      });
      expect(views[win]?.step).toEqual({
        kind: "win",
        title: "THE-STAND-IN",
        lines: ["THE-LIFT-GOES-NOWHERE", "A-VOUCHER"],
      });
      expect(steps.slice(win + 1)).toEqual(["results"]);
    }
  });

  it("says on the results screen that the run was won, and how the player got there", () => {
    for (const { views } of won) {
      const results = views.at(-1)?.step;
      if (results?.kind !== "results") throw new Error("No results.");

      expect(results).toMatchObject({
        title: "YOU-WON",
        intro: "HOW-YOU-WON",
        ending: { fired: false, won: true, text: "WON-IN-3" },
        route: [{ month: 3, text: "UP-TO THE-TOP IN 3, Ana Abel MOVED-UP" }],
      });
    }
  });

  it("leaves a run whose seat went to someone else to run on, and end as before", () => {
    for (const { views } of lost) {
      const results = views.at(-1)?.step;
      if (results?.kind !== "results") throw new Error("No results.");

      expect(kinds(views)).not.toContain("win");
      expect(views.at(-1)?.month).toBe(4);
      expect(results.ending.won).toBe(false);
      expect(results.route).toEqual([]);
    }
  });
});
