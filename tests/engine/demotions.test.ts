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
import { answer } from "./grand-plan-fixture";
import {
  decidedOn,
  edited,
  toldTitled,
  untilOpen,
  vacancyFixture,
  vacancyRaw,
  type Editable,
} from "./vacancy-fixture";

const SEEDS = Array.from({ length: 80 }, (_, i) => i + 1);
const content = vacancyFixture();

const entry = (view: PlayerView | undefined, name: string) =>
  view?.orgChart.find((e) => e.name === name);

const NAMES: Record<string, string> = { ben: "Ben Bird", cal: "Cal Cope" };

/** Plays the rest of a run, answering each Notification named with that option. */
function playAnswering(
  run: Run,
  answers: Record<string, string> = {},
): PlayerView[] {
  let view = run.view();
  const views = [view];
  while (view.choices.length > 0) {
    const { step } = view;
    const wanted = step.kind === "notification" ? answers[step.id] : undefined;
    const choice: Choice =
      step.kind === "notification" && wanted !== undefined
        ? answer(step.id, wanted)
        : (view.choices[0] as Choice);
    view = run.choose(choice);
    views.push(view);
  }
  return views;
}

const decisionOf = (run: Run) => readHiddenTruth(run).vacancies[0]?.decided;

/** The decider of Ana's seat, dealt this kind in the save. */
const asKind = (kind: Kind) => (state: Editable) => {
  const decider =
    state.truth.powerMap.influence.find((i) => i.over === "ana")?.who ?? "ana";
  const dealt = state.truth.characters.find((c) => c.id === decider);
  if (dealt) dealt.kind = kind;
};

/** A deal the player wins as the fixture plays it, with no mistake made. */
const winning = SEEDS.find(
  (s) => decidedOn(s, content).decided?.winner === "you",
);

/** The fixture with nobody competing for the seat. */
function nobodyCompeting(): Content {
  const raw = vacancyRaw();
  for (const c of raw.rivals.competing) {
    (c as { when: unknown }).when = { flag: "never-set" };
  }
  return parseContent(raw);
}
const unopposed = nobodyCompeting();

/** That deal, with its seat open, and whoever decides it dealt this kind. */
function openAs(kind: Kind, using: Content = content): Run {
  if (winning === undefined) throw new Error("Nobody wins.");
  const run = startRun({ seed: winning, content: using });
  untilOpen(run);
  return edited(run, using, asKind(kind));
}

describe("a big mistake while a seat is open", () => {
  it("costs the player a seat the same run wins without it, and the decision says so", () => {
    const clean = openAs("believer");
    playAnswering(clean, { "seat-talk": "wait" });
    const slipped = openAs("believer");
    const views = playAnswering(slipped, { "seat-talk": "slip" });

    expect(decisionOf(clean)?.winner).toBe("you");
    expect(decisionOf(slipped)?.winner).not.toBe("you");
    expect(decisionOf(slipped)?.blocked).toBe(true);
    const told = toldTitled(views, "SEAT-BLOCKED");
    if (told?.step.kind !== "notice") throw new Error("Never told.");
    expect(told.step.body).toMatch(/^(Ben Bird|Cal Cope) HAS-IT-AFTER-ALL$/);
    expect(told.step.decided?.inFact).toMatch(/TOLD-MISTAKE:/);
    const results = views.at(-1)?.step;
    if (results?.kind !== "results") throw new Error("No results.");
    expect(results.vacancies[0]?.inFact).toMatch(/FOR-YOU: MISTAKE:/);
  });

  it("rules the player out by the decider's kind, and only weighs against them with a Practitioner", () => {
    // Whoever decides owes the player, thinks well of them, and nobody else.
    const owed = (run: Run) =>
      edited(run, content, (state) => {
        const map = state.truth.powerMap;
        const decider =
          map.influence.find((i) => i.over === "ana")?.who ?? "ana";
        map.favours = [{ owes: decider, to: "you", why: "" }];
        map.influence = map.influence.filter(
          (i) => !["ben", "cal"].includes(i.over),
        );
        state.truth.beliefs[decider] = 50;
      });
    const believer = owed(openAs("believer"));
    playAnswering(believer, { "seat-talk": "slip" });
    const practitioner = owed(openAs("practitioner"));
    const views = playAnswering(practitioner, { "seat-talk": "slip" });

    expect(decisionOf(believer)?.winner).not.toBe("you");
    expect(decisionOf(practitioner)).toMatchObject({
      winner: "you",
      blocked: false,
    });
    expect(
      decisionOf(practitioner)?.candidates.find((c) => c.who === "you")
        ?.reasons,
    ).toContain("mistake");
    // A mistake that did not cost the seat is neither told nor listed.
    const won = toldTitled(views, "SEAT-WON");
    if (won?.step.kind !== "notice") throw new Error("Never told.");
    expect(won.step.decided?.inFact).not.toContain("MISTAKE");
    const results = views.at(-1)?.step;
    if (results?.kind !== "results") throw new Error("No results.");
    expect(results.vacancies[0]?.inFact).not.toContain("MISTAKE");
  });

  it("gives the seat to someone from the team when nobody else stands for it, and says the mistake cost it", () => {
    const run = openAs("believer", unopposed);
    const views = playAnswering(run, { "seat-talk": "slip" });

    expect(["ben", "cal"]).toContain(decisionOf(run)?.winner);
    expect(decisionOf(run)?.blocked).toBe(true);
    expect(toldTitled(views, "SEAT-BLOCKED")).toBeDefined();
    // Nobody stood for it, so nobody was passed over for it.
    expect(
      readHiddenTruth(run).memories.filter((m) =>
        m.about.startsWith("lost-the-seat"),
      ),
    ).toEqual([]);
  });

  it("says the mistake cost the seat of a player who would have had it unopposed, however strong the team", () => {
    // An Incompetent, who thinks little of the player, and owes and looks after Ben.
    const run = edited(openAs("incompetent", unopposed), unopposed, (state) => {
      const map = state.truth.powerMap;
      const decider = map.influence.find((i) => i.over === "ana")?.who ?? "ana";
      map.influence = [
        ...map.influence.filter((i) => i.over !== "ben"),
        { who: decider, over: "ben" },
      ];
      map.favours = [{ owes: decider, to: "ben", why: "" }];
      state.truth.beliefs[decider] = -50;
    });
    const views = playAnswering(run, { "seat-talk": "slip" });

    expect(decisionOf(run)).toMatchObject({ winner: "ben", blocked: true });
    expect(toldTitled(views, "SEAT-BLOCKED")).toBeDefined();
    expect(toldTitled(views, "SEAT-LOST")).toBeUndefined();
  });

  it("before the seat opens costs nothing but the Final Warning", () => {
    const run = openAs("believer");
    const before = edited(run, content, (state) => {
      (state as unknown as { mistakes: unknown[] }).mistakes.push({
        month: 2,
        choice: "EARLIER",
      });
    });
    playAnswering(before, { "seat-talk": "wait" });

    expect(decisionOf(before)?.winner).toBe("you");
  });
});

/**
 * The fixture run made a month longer, so that a player who has the seat has a
 * month upstairs, where a Notification can be a big mistake, and one back
 * downstairs, where another can.
 */
function demotable(): Content {
  const raw = vacancyRaw();
  raw.balance.monthsPerRun = 5;
  const slip = (id: string, floor: string, months: number[]) => ({
    id,
    floor,
    months,
    from: "People",
    subject: id,
    body: "A form.",
    options: [
      { id: "safe", label: "safe" },
      { id: "slip", label: "slip", mistake: "big" as const },
    ],
  });
  return parseContent({
    ...raw,
    notifications: [
      ...raw.notifications,
      slip("lead-slip", "lead-job", [1]),
      // Month 3 downstairs is the seat's, so that month 4 is written for too.
      { ...slip("month-3", "fixture-job", [3]), when: { flag: "never-set" } },
      slip("back-slip", "fixture-job", [4]),
    ],
  });
}

describe("a big mistake on the floor above", () => {
  const using = demotable();

  it("demotes the player: their job, floor and boss become those of the job below", () => {
    const run = openAs("believer", using);
    const views = playAnswering(run, {
      "seat-talk": "wait",
      "lead-slip": "slip",
    });
    const decided = decisionOf(run);
    const runnerUp = decided?.candidates
      .filter((c) => c.who !== "you")
      .sort((a, b) => b.strength - a.strength)[0]?.who;
    const successor = NAMES[runnerUp ?? ""] ?? "";

    expect(decided?.winner).toBe("you");
    const upstairs = views.find((v) => v.month === 4);
    expect(upstairs?.job.id).toBe("lead-job");
    expect(toldTitled(views, "WARNED")?.month).toBe(4);
    const demoted = toldTitled(views, "DEMOTED");
    expect(demoted?.month).toBe(5);
    expect(demoted?.step).toMatchObject({ body: `${successor} HAS-YOUR-SEAT` });
    const after = views.find((v) => v.month === 5 && v.step.kind === "story");
    expect(after?.job).toEqual({ id: "fixture-job", title: "FIXTURE-JOB" });
    expect(after?.finalWarning).toBe(true);
    // Nobody answers to the player any more, so the chart leaves them off.
    expect(entry(after, "YOU-ON-THE-CHART")).toBeUndefined();
    expect(entry(after, successor)).toEqual({
      name: successor,
      title: "Boss, YOUR-BOSS",
      reportsTo: "Dee Dunn",
    });
    expect(entry(after, "Dee Dunn")?.title).toBe("Head, YOUR-BOSSS-BOSS");
    const other = successor === "Ben Bird" ? "Cal Cope" : "Ben Bird";
    expect(entry(after, other)?.reportsTo).toBe(successor);
  });

  it("plays the floor below's content on, from where the player left it", () => {
    const run = openAs("believer", using);
    const views = playAnswering(run, {
      "seat-talk": "wait",
      "lead-slip": "slip",
    });

    expect(
      views.some(
        (v) =>
          v.month === 5 &&
          v.step.kind === "notification" &&
          v.step.id === "back-slip",
      ),
    ).toBe(true);
  });

  it("still fires the player for a second big mistake", () => {
    const run = openAs("believer", using);
    const views = playAnswering(run, {
      "seat-talk": "wait",
      "lead-slip": "slip",
      "back-slip": "slip",
    });

    expect(toldTitled(views, "FIRED")?.month).toBe(5);
    expect(views.at(-1)?.step.kind).toBe("results");
  });

  it("leaves a player with no mistake upstairs", () => {
    const run = openAs("believer", using);
    const views = playAnswering(run, { "seat-talk": "wait" });

    expect(views.findLast((v) => v.month === 5)?.job.id).toBe("lead-job");
    expect(toldTitled(views, "DEMOTED")).toBeUndefined();
  });
});

describe("the content checks", () => {
  it("refuses seats with no words for being demoted", () => {
    const raw = vacancyRaw();
    const mistakes: Partial<typeof raw.mistakes> = { ...raw.mistakes };
    delete mistakes.demoted;

    expect(() => parseContent({ ...raw, mistakes })).toThrow(
      "mistakes.json needs the words for being demoted",
    );
  });
});
