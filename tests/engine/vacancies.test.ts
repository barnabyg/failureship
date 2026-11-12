import { describe, expect, it } from "vitest";
import {
  parseContent,
  startRun,
  type Choice,
  type Content,
  type Kind,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { answer, play } from "./grand-plan-fixture";
import { firstTold } from "./landed";
import {
  decidedOn,
  edited,
  playRest,
  playThrough,
  toldTitled,
  untilOpen,
  vacancyFixture,
  vacancyRaw,
  withSeatMove,
  type Editable,
} from "./vacancy-fixture";

const SEEDS = Array.from({ length: 80 }, (_, i) => i + 1);
const content = vacancyFixture();

const entry = (view: PlayerView | undefined, name: string) =>
  view?.orgChart.find((e) => e.name === name);

const influencer = (state: Editable, id: string) =>
  state.truth.powerMap.influence.find((i) => i.over === id)?.who;

/** The decider's kind, set in the save, as if dealt so. */
const asKind = (kind: Kind) => (state: Editable) => {
  const decider = influencer(state, "ana") ?? "ana";
  const dealt = state.truth.characters.find((c) => c.id === decider);
  if (dealt) dealt.kind = kind;
};

/** Plays the rest of a run, answering the seat's Notification with this. */
function playWith(run: Run, optionId: string): PlayerView[] {
  let view = run.view();
  const views = [view];
  while (view.choices.length > 0) {
    const { step } = view;
    const choice =
      step.kind === "notification" && step.id === "seat-talk"
        ? answer("seat-talk", optionId)
        : (view.choices[0] as Choice);
    view = run.choose(choice);
    views.push(view);
  }
  return views;
}

const winnerOf = (run: Run) =>
  readHiddenTruth(run).vacancies[0]?.decided?.winner;

/**
 * A deal in which Dee, the boss's boss, holds influence over the boss, and has
 * a protégé among the peers: someone else decides, and has a favourite.
 */
const deeDecides = SEEDS.find((s) => {
  const { truth, decided } = decidedOn(s, content);
  return (
    decided?.decider === "dee" &&
    truth.powerMap.influence.some(
      (i) => i.who === "dee" && ["ben", "cal"].includes(i.over),
    )
  );
});

/** That deal, opened, with Dee dealt this kind. */
function openWithDee(kind: Kind, using: Content = content): Run {
  if (deeDecides === undefined) throw new Error("No such deal.");
  const run = startRun({ seed: deeDecides, content: using });
  untilOpen(run);
  return edited(run, using, asKind(kind));
}

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
  it("is won in one deal, and lost in the same deal with only the Power Map changed", () => {
    const seed = SEEDS.find(
      (s) => decidedOn(s, content).decided?.winner === "you",
    );
    if (seed === undefined) throw new Error("Nobody wins.");
    const run = startRun({ seed, content });
    untilOpen(run);

    const same = edited(run, content, () => undefined);
    playRest(same);
    // Ben, a peer, now holds influence over the boss, and so decides.
    const changed = edited(run, content, (state) => {
      const map = state.truth.powerMap;
      const above = influencer(state, "ana");
      map.influence = [
        ...map.influence.filter((i) => i.over !== "ana" && i.over !== "ben"),
        { who: "ben", over: "ana" },
        ...(above !== undefined && above !== "ben"
          ? [{ who: above, over: "ben" }]
          : []),
      ];
    });
    playRest(changed);

    expect(winnerOf(same)).toBe("you");
    expect(readHiddenTruth(changed).vacancies[0]?.decided).toMatchObject({
      decider: "ben",
      winner: "ben",
    });
  });

  it("is picked differently by deciders of different kinds, from the same candidates", () => {
    // The player really delivered the Plan, and Dee has a protégé among the peers.
    const believer = openWithDee("believer");
    playRest(believer);
    const practitioner = openWithDee("practitioner");
    playRest(practitioner);

    expect(winnerOf(believer)).toBe("you");
    expect(winnerOf(practitioner)).not.toBe("you");
    const candidates = (run: Run) =>
      readHiddenTruth(run).vacancies[0]?.decided?.candidates.map(
        ({ who, reasons }) => [who, reasons],
      );
    expect(candidates(believer)).toEqual(candidates(practitioner));
    expect(
      readHiddenTruth(believer).vacancies[0]?.decided?.candidates.find(
        (c) => c.who === "you",
      )?.reasons,
    ).toContain("delivered");
  });

  it("is not won by a high Gauge or a pleased boss, against whoever really decides", () => {
    const run = openWithDee("practitioner");

    const flattered = edited(run, content, (state) => {
      state.gauges.teflon = 100;
      state.truth.beliefs.ana = 50;
    });
    playRest(flattered);
    const wooed = edited(run, content, (state) => {
      state.truth.beliefs.dee = 50;
    });
    playRest(wooed);

    expect(winnerOf(flattered)).not.toBe("you");
    expect(winnerOf(wooed)).toBe("you");
  });
});

describe("what is done for an open seat", () => {
  it("counts when the player approaches whoever decides, and not when they approach anyone else", () => {
    const bystander = (["ben", "cal"] as const).find((id) => {
      const { truth } = decidedOn(deeDecides ?? 0, content);
      return !truth.powerMap.favours.some(
        (f) => f.owes === "dee" && f.to === id,
      );
    });
    const toDee = openWithDee("practitioner");
    playWith(toDee, "approach-dee");
    const toSomeoneElse = openWithDee("practitioner");
    playWith(toSomeoneElse, `approach-${bystander ?? "ben"}`);

    expect(winnerOf(toDee)).toBe("you");
    expect(winnerOf(toSomeoneElse)).not.toBe("you");
    expect(
      readHiddenTruth(toDee).memories.find(
        (m) => m.character === "dee" && m.text === "APPROACHED",
      ),
    ).toBeDefined();
  });

  it("calls in a favour owed by whoever decides, which counts most with a Practitioner", () => {
    const owed = (run: Run) =>
      edited(run, content, (state) => {
        state.truth.powerMap.favours.push({ owes: "dee", to: "you", why: "" });
      });
    const kept = owed(openWithDee("practitioner"));
    playWith(kept, "wait");
    const called = owed(openWithDee("practitioner"));
    playWith(called, "call-in");

    expect(winnerOf(kept)).not.toBe("you");
    expect(winnerOf(called)).toBe("you");
    expect(readHiddenTruth(called).powerMap.favours).not.toContainEqual(
      expect.objectContaining({ owes: "dee", to: "you" }),
    );
  });

  it("claims the Plan's credit, which counts with an Incompetent", () => {
    const quiet = openWithDee("incompetent");
    playWith(quiet, "wait");
    const claimed = openWithDee("incompetent");
    playWith(claimed, "claim");

    expect(winnerOf(quiet)).not.toBe("you");
    expect(winnerOf(claimed)).toBe("you");
  });

  it("lets a competitor tell whoever decides a story about the player", () => {
    const using = withSeatMove({ story: true });
    const run = openWithDee("believer", using);
    const views = playRest(run);

    const told = firstTold(views, "FOR-THE-SEAT");
    const truth = readHiddenTruth(run);
    const story = truth.memories.find(
      (m) => m.character === "dee" && m.text === "A-STORY-ABOUT-YOU",
    );
    expect(told?.month).toBe(3);
    expect(["ben", "cal"]).toContain(story?.via);
    expect(
      truth.vacancies[0]?.decided?.candidates.find((c) => c.who === "you")
        ?.reasons,
    ).toContain("cold");
  });

  it("lets a competitor get into the decider's diary, so that they are owed", () => {
    const using = withSeatMove({ diary: true });
    const run = openWithDee("practitioner", using);
    playRest(run);

    const truth = readHiddenTruth(run);
    const lunch = truth.powerMap.favours.find(
      (f) => f.owes === "dee" && f.why === "A-LONG-LUNCH",
    );
    expect(lunch).toBeDefined();
    expect(
      truth.vacancies[0]?.decided?.candidates.find((c) => c.who === lunch?.to)
        ?.reasons,
    ).toContain("owed");
  });

  it("lets a competitor take the Plan's credit from the player", () => {
    const using = withSeatMove({ credit: true });
    const run = openWithDee("incompetent", using);
    playWith(run, "claim");

    const decided = readHiddenTruth(run).vacancies[0]?.decided;
    // The Move lands after the player's claim, so the credit is theirs last.
    const credited = decided?.candidates.filter((c) =>
      c.reasons.includes("credited"),
    );
    expect(credited?.map((c) => c.who)).toHaveLength(1);
    expect(credited?.[0]?.who).not.toBe("you");
  });
});

describe("the decision", () => {
  it("is told with Official standing beside who decided and the winner's tie, and no more", () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const { views, decided } = decidedOn(seed, content);
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
      const { inFact } = told.step.decided ?? { inFact: "" };
      expect(inFact).toMatch(/^DECIDED-BY:.+? (TOLD-|CLOSE:|UNTOLD:)/);
      // Nothing of how anyone feels about the player, or of a favour still owed.
      expect(inFact).not.toMatch(/WARM|NEUTRAL|COLD|OWED-YOU|FOR-YOU/);
    }
  });

  it("gives every reason on the results screen", () => {
    const { views } = decidedOn(1, content);
    const results = views.at(-1)?.step;
    if (results?.kind !== "results") throw new Error("No results.");

    expect(results.vacancies).toEqual([
      expect.objectContaining({ month: 3, onPaper: "GREEN" }),
    ]);
    expect(results.vacancies[0]?.text).toMatch(/^Ana Abel SEAT WENT TO /);
    expect(results.vacancies[0]?.inFact).toMatch(/WARM|NEUTRAL|COLD/);
  });

  it("is told before the results when it is decided as the run ends", () => {
    const raw = vacancyRaw();
    raw.balance.monthsPerRun = 3;
    const short = parseContent(raw);
    const run = startRun({ seed: 1, content: short });
    const views = playThrough(run);

    const told = views.findIndex(
      (v) => v.step.kind === "notice" && v.step.decided !== undefined,
    );
    expect(told).toBeGreaterThan(0);
    expect(views.at(-1)?.step.kind).toBe("results");
    expect(views.slice(told + 1).map((v) => v.step.kind)).toEqual(["results"]);
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
    const seat = lost.views.find(
      (v) => v.step.kind === "notice" && v.step.title === "SEAT-LOST",
    );
    expect(seat?.step).toMatchObject({ body: `${winner} HAS-IT` });
  });

  it("keeps the floor above's cast off the player's charts until they reach it", () => {
    const { views } = decidedOn(1, content);
    const first = views[0];
    const results = views.at(-1)?.step;
    if (results?.kind !== "results") throw new Error("No results.");
    const reached = views.at(-2)?.job.id === "lead-job";

    expect(entry(first, "Eve Ewart")).toBeUndefined();
    expect(entry(first, "Dee Dunn")?.reportsTo).toBeNull();
    expect(results.characters.some((c) => c.name === "Eve Ewart")).toBe(
      reached,
    );
    expect(results.powerMap.some((c) => c.name === "Eve Ewart")).toBe(reached);
  });
});

describe("those passed over", () => {
  const outcomes = SEEDS.map((s) => decidedOn(s, content));
  const grudge = (views: PlayerView[]) => firstTold(views, "BEN-REMEMBERS");

  it("remember it, and come back on a player who had the seat", () => {
    const won = outcomes.find((o) => o.decided?.winner === "you");
    if (!won) throw new Error("Nobody wins.");

    expect(won.truth.memories).toContainEqual(
      expect.objectContaining({
        character: "ben",
        about: "lost-the-seat-to-you",
        month: 3,
      }),
    );
    expect(grudge(won.views)?.month).toBe(4);
  });

  it("do not come back on a player who was passed over too", () => {
    const calWon = outcomes.find((o) => o.decided?.winner === "cal");
    if (!calWon) throw new Error("Cal never wins.");

    expect(calWon.truth.memories).toContainEqual(
      expect.objectContaining({ character: "ben", about: "lost-the-seat" }),
    );
    expect(grudge(calWon.views)).toBeUndefined();
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

  it("refuses reading or acting for a seat with no seats written", () => {
    expect(
      refused((raw) => {
        delete (raw as { vacancies?: unknown }).vacancies;
      }),
    ).toThrow("reads whether a seat is open, but no seats are written");
    expect(
      refused((raw) => {
        delete (raw as { vacancies?: unknown }).vacancies;
      }),
    ).toThrow("acts for a seat, but no seats are written");
  });

  it("refuses a story or a diary from the player, a Move for a seat with no maker, and approaching nobody", () => {
    // Written as the data files are, past what the fixture's own types allow.
    const talk = (raw: ReturnType<typeof vacancyRaw>) =>
      raw.notifications.find((n) => n.id === "seat-talk")?.options as
        unknown[] | undefined;
    expect(
      refused((raw) => {
        talk(raw)?.push({
          id: "gossip",
          label: "Gossip",
          seat: { story: true },
          result: { title: "T", body: "B" },
        });
      }),
    ).toThrow("which only a Move does");
    expect(
      refused((raw) => {
        talk(raw)?.push({
          id: "nobody",
          label: "Nobody",
          seat: { approach: "zed" },
          result: { title: "T", body: "B" },
        });
      }),
    ).toThrow('approaches unknown "zed"');
    expect(
      refused((raw) => {
        (raw.moves as unknown[]).push({
          id: "anonymous",
          from: "Someone",
          title: "ANON",
          body: "Anon.",
          seat: { credit: true },
        });
      }),
    ).toThrow('Move "anonymous" acts for a seat, so it needs a "by"');
  });
});
