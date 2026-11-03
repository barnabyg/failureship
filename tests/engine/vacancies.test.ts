import { describe, expect, it } from "vitest";
import { parseContent, startRun, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { play } from "./grand-plan-fixture";
import {
  decidedOn,
  edited,
  playRest,
  playThrough,
  toldTitled,
  untilOpen,
  vacancyFixture,
  vacancyRaw,
} from "./vacancy-fixture";

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const content = vacancyFixture();

const entry = (view: PlayerView | undefined, name: string) =>
  view?.orgChart.find((e) => e.name === name);

describe("a seat falling vacant", () => {
  it("opens when the boss completes their Grand Plan and counts it done", () => {
    const run = startRun({ seed: 1, content });
    const views = playThrough(run);

    const opened = toldTitled(views, "SEAT-OPEN");
    expect(opened?.month).toBe(3);
    expect(opened?.step).toMatchObject({
      body: "Your boss MOVES-UP, DECIDED-IN-3",
    });
    expect(readHiddenTruth(run).vacancies).toMatchObject([
      { holder: "ana", opened: 3, decides: 3 },
    ]);
  });

  it("does not open when the Plan is left undone", () => {
    const run = startRun({ seed: 1, content });
    play(run, "leave", "paper-trail");

    expect(readHiddenTruth(run).vacancies).toEqual([]);
  });

  it("is decided by whoever holds influence over the boss on the Power Map", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const { truth, decided } = decidedOn(seed, content);
      const above = truth.powerMap.influence.find((i) => i.over === "ana");

      expect(decided?.decider, `seed ${String(seed)}`).toBe(
        above?.who ?? "ana",
      );
      // The player and the peers competing for it: never the boss moving up.
      expect(decided?.candidates.map((c) => c.who).sort()).toEqual(
        ["ben", "cal", "you"].sort(),
      );
    }
  });
});

describe("who gets the seat", () => {
  it("wins in one deal and loses in another, on the same choices, by the Power Map", () => {
    const outcomes = SEEDS.map((seed) => decidedOn(seed, content));
    const won = outcomes.find((o) => o.decided?.winner === "you");
    const lost = outcomes.find(
      (o) => o.decided !== null && o.decided.winner !== "you",
    );
    if (!won || !lost) throw new Error("Every deal went the same way.");

    expect(JSON.stringify(won.truth.powerMap)).not.toBe(
      JSON.stringify(lost.truth.powerMap),
    );
    // Whoever beat the player had the Power Map on their side, and nothing
    // else of theirs counts.
    const winner = lost.decided?.candidates.find(
      (c) => c.who === lost.decided?.winner,
    );
    expect(
      winner?.reasons.some((r) =>
        ["self", "owed", "protege", "circle"].includes(r),
      ),
    ).toBe(true);
  });

  it("is not won by a high Gauge or a pleased boss, against whoever really decides", () => {
    // A deal in which someone else decides, and has a protégé among the peers.
    const seed = SEEDS.find((s) => {
      const { truth, decided } = decidedOn(s, content);
      return (
        decided !== null &&
        decided.decider !== "ana" &&
        truth.powerMap.influence.some(
          (i) => i.who === decided.decider && ["ben", "cal"].includes(i.over),
        )
      );
    });
    if (seed === undefined) throw new Error("No such deal.");
    const run = startRun({ seed, content });
    untilOpen(run);
    const { decider } = decidedOn(seed, content).decided ?? {};

    const flattered = edited(run, content, (state) => {
      state.gauges.teflon = 100;
      state.truth.beliefs.ana = 50;
    });
    playRest(flattered);
    const wooed = edited(run, content, (state) => {
      state.truth.beliefs[decider ?? ""] = 50;
    });
    playRest(wooed);

    expect(readHiddenTruth(flattered).vacancies[0]?.decided?.winner).not.toBe(
      "you",
    );
    expect(readHiddenTruth(wooed).vacancies[0]?.decided?.winner).toBe("you");
  });
});

describe("the decision", () => {
  it("is told with Official standing beside who really decided, and why", () => {
    const { views, decided } = decidedOn(1, content);
    const told = views.find(
      (v) => v.step.kind === "notice" && v.step.decided !== undefined,
    );
    if (told?.step.kind !== "notice") throw new Error("Never told.");

    expect(told.month).toBe(4);
    expect(told.step.title).toBe(
      decided?.winner === "you" ? "SEAT-WON" : "SEAT-LOST",
    );
    expect(told.step.decided?.onPaper).toMatchObject({
      label: "ON-PAPER",
      band: "GREEN",
      text: "PAPER-GREEN",
    });
    expect(told.step.decided?.inFact).toMatch(/^DECIDED-BY:/);
    const results = views.at(-1)?.step;
    if (results?.kind !== "results") throw new Error("No results.");
    expect(results.vacancies).toEqual([
      expect.objectContaining({ month: 3, onPaper: "GREEN" }),
    ]);
    expect(results.vacancies[0]?.text).toMatch(/^Ana Abel SEAT WENT TO /);
  });

  it("makes a winner the head of the team, on the floor above, under the boss's boss", () => {
    const won = SEEDS.map((s) => decidedOn(s, content)).find(
      (o) => o.decided?.winner === "you",
    );
    if (!won) throw new Error("Nobody wins.");
    const last = won.views.at(-2);

    expect(last?.month).toBe(4);
    expect(last?.job).toEqual({ id: "lead-job", title: "LEAD-JOB" });
    expect(entry(last, "YOU-ON-THE-CHART")).toEqual({
      name: "YOU-ON-THE-CHART",
      title: "LEAD-JOB",
      reportsTo: "Dee Dunn",
    });
    expect(entry(last, "Ben Bird")?.reportsTo).toBe("YOU-ON-THE-CHART");
    expect(entry(last, "Dee Dunn")?.title).toBe("Head, YOUR-BOSS");
    expect(entry(last, "Eve Ewart")?.title).toBe("Chief, YOUR-BOSSS-BOSS");
    expect(entry(last, "Ana Abel")).toEqual({
      name: "Ana Abel",
      title: "UPSTAIRS",
      reportsTo: "Eve Ewart",
    });
  });

  it("makes whoever else wins the player's boss, and the player stays", () => {
    const lost = SEEDS.map((s) => decidedOn(s, content)).find(
      (o) => o.decided !== null && o.decided.winner !== "you",
    );
    if (!lost) throw new Error("The player always wins.");
    const last = lost.views.at(-2);
    const winner = lost.decided?.winner === "ben" ? "Ben Bird" : "Cal Cope";

    expect(last?.job.id).toBe("fixture-job");
    expect(entry(last, winner)).toEqual({
      name: winner,
      title: "Boss, YOUR-BOSS",
      reportsTo: "Dee Dunn",
    });
    expect(entry(last, "Ana Abel")?.reportsTo).toBe("Eve Ewart");
    const seat = lost.views.find(
      (v) => v.step.kind === "notice" && v.step.title === "SEAT-LOST",
    );
    expect(seat?.step).toMatchObject({ body: `${winner} HAS-IT` });
  });

  it("is remembered by whoever was passed over, who can act on it", () => {
    const outcome = SEEDS.map((s) => decidedOn(s, content)).find(
      (o) => o.decided !== null && o.decided.winner !== "ben",
    );
    if (!outcome) throw new Error("Ben always wins.");

    expect(
      outcome.truth.memories.filter((m) => m.about === "passed-over"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ character: "ben", month: 3 }),
      ]),
    );
    const grudge = outcome.views.find(
      (v) => v.step.kind === "move" && v.step.title === "BEN-REMEMBERS",
    );
    expect(grudge?.month).toBe(4);
  });
});

describe("the content checks", () => {
  const refused = (change: (raw: ReturnType<typeof vacancyRaw>) => void) => {
    const raw = vacancyRaw();
    change(raw);
    return () => parseContent(raw);
  };

  it("refuses a seat on an unknown floor, or that leads nowhere new", () => {
    expect(
      refused((raw) => {
        const [seat] = raw.vacancies.seats;
        if (seat) seat.job = "no-such-job";
      }),
    ).toThrow('Seat "boss-seat" names unknown floor "no-such-job".');
    expect(
      refused((raw) => {
        const [seat] = raw.vacancies.seats;
        if (seat) seat.job = seat.floor;
      }),
    ).toThrow("leads to the floor it is on");
  });

  it("refuses a seat competed for as nothing written, or moving its holder under themselves", () => {
    expect(
      refused((raw) => {
        const [seat] = raw.vacancies.seats;
        if (seat) seat.competing = "nothing";
      }),
    ).toThrow('unknown "nothing" in rivals.json');
    expect(
      refused((raw) => {
        const [seat] = raw.vacancies.seats;
        if (seat) seat.movesUp.reportsTo = "ben";
      }),
    ).toThrow("someone under them");
  });

  it("refuses reading whether a seat is open with no seats written", () => {
    expect(
      refused((raw) => {
        delete (raw as { vacancies?: unknown }).vacancies;
      }),
    ).toThrow("reads whether a seat is open, but no seats are written");
  });
});
