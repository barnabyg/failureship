import { describe, expect, it } from "vitest";
import {
  parseContent,
  resumeRun,
  startRun,
  type Choice,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { answer } from "./grand-plan-fixture";
import { playThrough, vacancyRaw } from "./vacancy-fixture";

const SEEDS = Array.from({ length: 80 }, (_, i) => i + 1);

const WIN = {
  title: "THE-STAND-IN",
  lines: ["THE-LIFT-GOES-NOWHERE", "A-VOUCHER"],
  reached: "THE-TOP",
  results: { title: "YOU-WON", intro: "HOW-YOU-WON" },
  ending: "WON-IN-{month}",
};

type Seat = ReturnType<typeof vacancyRaw>["vacancies"]["seats"][number];

/** A seat as written, without the job it leads to. */
function withoutJob(seat: Seat): Omit<Seat, "job"> {
  const rest: Partial<Seat> = { ...seat };
  delete rest.job;
  return rest as Omit<Seat, "job">;
}

/** The seat fixture, with Ana's seat the way out of the top floor. */
function winRaw(win: Record<string, unknown> = WIN) {
  const raw = vacancyRaw();
  const [seat] = raw.vacancies.seats;
  if (!seat) throw new Error("No seat.");
  return {
    ...raw,
    vacancies: {
      ...raw.vacancies,
      seats: [{ ...withoutJob(seat), win }] as unknown as Seat[],
    },
  };
}

const content = parseContent(winRaw());

function decidedOn(seed: number, on: Content = content) {
  const run = startRun({ seed, content: on });
  const views = playThrough(run);
  const winner = readHiddenTruth(run).vacancies[0]?.decided?.winner;
  return { views, winner };
}

const kinds = (views: readonly PlayerView[]) => views.map((v) => v.step.kind);

describe("winning the way out of the top floor", () => {
  const won = SEEDS.map((s) => decidedOn(s)).filter((d) => d.winner === "you");
  const lost = SEEDS.map((s) => decidedOn(s)).filter((d) => d.winner !== "you");

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

describe("seats that win, as written", () => {
  it("refuses a seat with both a job to lead to and a win, or neither", () => {
    const raw = vacancyRaw();
    const [seat] = raw.vacancies.seats;
    if (!seat) throw new Error("No seat.");
    const seats = (written: Seat) => ({
      ...raw,
      vacancies: { ...raw.vacancies, seats: [written] },
    });

    expect(() => parseContent(seats({ ...seat, win: WIN } as Seat))).toThrow(
      /needs either a "job" to lead to or a "win", and not both/,
    );
    expect(() => parseContent(seats(withoutJob(seat) as Seat))).toThrow(
      /needs either a "job" to lead to or a "win", and not both/,
    );
  });

  it("refuses more than one seat that wins the run", () => {
    const raw = winRaw();
    const [won] = raw.vacancies.seats;
    if (!won) throw new Error("No seat.");
    const second = { ...won, id: "second-seat", floor: "lead-job" };

    expect(() =>
      parseContent({
        ...raw,
        vacancies: { ...raw.vacancies, seats: [won, second] },
      }),
    ).toThrow(/Only one seat can win the run/);
  });
});

/**
 * Ana's seat leads to Dee's floor, where Dee's own seat wins the run. Dee is
 * seconded upstairs in month 4, so her seat is open in month 5, when the
 * player can slip up.
 */
function climbRaw() {
  const raw = vacancyRaw();
  const [seat] = raw.vacancies.seats;
  if (!seat) throw new Error("No seat.");
  const top = {
    ...withoutJob(seat),
    id: "dee-seat",
    floor: "lead-job",
    win: WIN,
  } as unknown as Seat;
  return {
    ...raw,
    balance: { ...raw.balance, monthsPerRun: 6 },
    notifications: [
      ...raw.notifications,
      {
        id: "slip-up",
        floor: "lead-job",
        when: { vacancyOpen: true },
        from: "People",
        subject: "THE-TOP-SEAT-IS-OPEN",
        body: "Slip up?",
        options: [
          { id: "carry-on", label: "Carry on" },
          { id: "slip-up-now", label: "Slip up", mistake: "big" },
        ],
      },
    ],
    events: [
      {
        id: "dee-up",
        floor: "lead-job",
        from: "The Board",
        title: "DEE-SECONDED",
        body: "Dee goes upstairs.",
        changed: "DEE-WENT-UP",
        schedule: { months: [4], chance: 1 },
        vacates: "movedUp",
        story: { reported: "DEE-REPORTED" },
      },
    ],
    vacancies: { ...raw.vacancies, seats: [seat, top] },
  };
}

/** Plays on, doing Ana's Plan for real, slipping up while Dee's seat is open. */
function playClimb(run: Run, until = Infinity): PlayerView[] {
  let view = run.view();
  const views = [view];
  while (view.choices.length > 0 && view.month < until) {
    const { step } = view;
    const choice: Choice =
      step.kind === "notification" && step.id === "plan-work"
        ? answer("plan-work", "really")
        : step.kind === "notification" && step.id === "slip-up"
          ? answer("slip-up", "slip-up-now")
          : (view.choices[0] as Choice);
    view = run.choose(choice);
    views.push(view);
  }
  return views;
}

describe("a player taken back down while the seat above is open", () => {
  const climb = parseContent(climbRaw());

  // With the player's team gone, nobody takes their seat, and nobody but Dee's
  // own team could stand for hers: there is nobody.
  it("is out of the running, and with nobody else in it the seat stays empty", () => {
    const seeds = SEEDS.filter((seed) => {
      const run = startRun({ seed, content: climb });
      playClimb(run);
      return readHiddenTruth(run).vacancies[0]?.decided?.winner === "you";
    });
    expect(seeds.length).toBeGreaterThan(0);

    for (const seed of seeds.slice(0, 5)) {
      const first = startRun({ seed, content: climb });
      playClimb(first, 5);
      const saved = JSON.parse(first.save()) as {
        state: { gone: { character: string; month: number; how: string }[] };
      };
      saved.state.gone.push(
        { character: "ben", month: 4, how: "left" },
        { character: "cal", month: 4, how: "left" },
      );
      const run = resumeRun({ save: JSON.stringify(saved), content: climb });
      const views = playClimb(run);
      const truth = readHiddenTruth(run);
      const owner = `seed ${String(seed)}`;

      expect(kinds(views), owner).not.toContain("win");
      expect(
        truth.vacancies.map((v) => v.seat),
        owner,
      ).toEqual(["boss-seat"]);
      expect(views.at(-1)?.job.id, owner).toBe("fixture-job");
      expect(views.at(-1)?.month, owner).toBe(6);
    }
  });
});
