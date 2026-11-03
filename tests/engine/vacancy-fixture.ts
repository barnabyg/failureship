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
import { answer, raw as planRaw } from "./grand-plan-fixture";
import { room } from "./fixture";

const reason = (strength: number, why: string) => ({ strength, why });

/**
 * The Grand Plan fixture, with a seat to fill. Ana is the boss, under Dee, and
 * Ben and Cal are the player's peers. Eve, at the top, is written for the floor
 * above, which has a desk of its own. Done for real in month 2, Ana's Plan
 * counts with every kind of boss, so her seat is open in month 3 and decided as
 * it closes. Warm beats a protégé, and a protégé beats someone merely neutral.
 */
export function vacancyRaw() {
  const base = planRaw();
  const [bigPlan, ...otherPlans] = base.grandPlans.plans;
  if (!bigPlan) throw new Error("No Plan to complete.");
  const plan = {
    ...bigPlan,
    ways: bigPlan.ways.map((w) =>
      w.id === "really"
        ? { ...w, counts: ["believer", "incompetent", "practitioner"] }
        : w,
    ),
  };
  return {
    ...base,
    hiddenTruth: { ...base.hiddenTruth, charactersWithFact: 3 },
    characters: [
      { id: "ana", name: "Ana Abel", title: "Boss", reportsTo: "dee" },
      { id: "ben", name: "Ben Bird", title: "Analyst", reportsTo: "ana" },
      { id: "cal", name: "Cal Cope", title: "Clerk", reportsTo: "ana" },
      { id: "dee", name: "Dee Dunn", title: "Head", reportsTo: "eve" },
      { id: "eve", name: "Eve Ewart", title: "Chief", floor: "lead-job" },
    ],
    you: { reportsTo: "ana", job: "fixture-job", name: "YOU-ON-THE-CHART" },
    places: {
      boss: { called: "your boss", title: "{title}, YOUR-BOSS" },
      head: { called: "your boss's boss", title: "{title}, YOUR-BOSSS-BOSS" },
    },
    notifications: [
      ...base.notifications,
      {
        id: "lead-own",
        floor: "lead-job",
        pool: true,
        when: { flag: "never-set" },
        from: "Facilities",
        subject: "NEVER-SEEN-UPSTAIRS",
        body: "Never seen.",
        options: [{ id: "noted", label: "Noted" }],
      },
    ],
    floors: [
      ...base.floors,
      { job: "lead-job", title: "LEAD-JOB", rooms: [room("lead-desk", 0)] },
    ],
    grandPlans: { ...base.grandPlans, plans: [plan, ...otherPlans] },
    gauges: [
      {
        id: "teflon",
        label: "TEFLON",
        start: 50,
        min: 0,
        max: 100,
        milestones: [],
      },
    ],
    moves: [
      {
        id: "grudge",
        from: "Ben Bird",
        by: "ben",
        title: "BEN-REMEMBERS",
        body: "Ben has not forgotten.",
        when: { remembers: { character: "ben", about: "passed-over" } },
      },
    ],
    rivals: {
      competing: [
        {
          id: "seat",
          for: "THE-SEAT",
          who: ["{peers}"],
          when: { vacancyOpen: true },
        },
      ],
      most: 2,
      dealAgain: 0,
      moveChance: 0,
      makers: { believer: 1, incompetent: 2, practitioner: 3 },
      didNothing: "DID-NOTHING",
    },
    vacancies: {
      seats: [
        {
          id: "boss-seat",
          floor: "fixture-job",
          job: "lead-job",
          competing: "seat",
          openFor: 1,
          movesUp: { reportsTo: "eve", title: "UPSTAIRS", called: "UP-THERE" },
          opened: {
            title: "SEAT-OPEN",
            body: "{holder} MOVES-UP, DECIDED-IN-{month}",
          },
          won: { title: "SEAT-WON", body: "You have it, not {winner}." },
          lost: { title: "SEAT-LOST", body: "{winner} HAS-IT" },
        },
      ],
      passedOver: {
        about: "passed-over",
        forYou: { text: "PASSED-OVER-FOR {winner}", tone: "bad" },
        forSomeoneElse: { text: "PASSED-OVER-FOR {winner}" },
      },
      reasons: {
        self: reason(9, "SELF:{who}"),
        owed: reason(4, "OWED:{decider}>{who}"),
        protege: reason(3, "PROTEGE:{decider}>{who}"),
        circle: reason(1, "CIRCLE:{decider}>{who}"),
        rival: reason(1, "RIVAL:{who}"),
        owedYou: reason(4, "OWED-YOU:{decider}"),
        warm: reason(5, "WARM:{decider}"),
        neutral: reason(1, "NEUTRAL:{decider}"),
        cold: reason(0, "COLD:{decider}"),
      },
      close: "CLOSE:{who}",
      inFact: "DECIDED-BY:{decider} {why}",
      asForYou: "FOR-YOU: {why}",
      results: "{holder} SEAT WENT TO {winner} IN {month}",
    },
  };
}

export function vacancyFixture(): Content {
  return parseContent(vacancyRaw());
}

/** Plays a run to the end, completing Ana's Plan in month 2, and taking the first choice otherwise. */
export function playThrough(run: Run): PlayerView[] {
  return playOn(run, run.view(), true);
}

function playOn(run: Run, first: PlayerView, complete: boolean): PlayerView[] {
  let view = first;
  const views = [view];
  while (view.choices.length > 0) {
    const { step } = view;
    const choice: Choice =
      complete && step.kind === "notification" && step.id === "plan-work"
        ? answer("plan-work", "really")
        : (view.choices[0] as Choice);
    view = run.choose(choice);
    views.push(view);
  }
  return views;
}

/** Plays to the month the seat is open in, before anything happens in it. */
export function untilOpen(run: Run): PlayerView {
  let view = run.view();
  while (view.month < 3) {
    const { step } = view;
    view = run.choose(
      step.kind === "notification" && step.id === "plan-work"
        ? answer("plan-work", "really")
        : (view.choices[0] as Choice),
    );
  }
  return view;
}

/** Plays on from a resumed run, as `playThrough` does. */
export function playRest(run: Run): PlayerView[] {
  return playOn(run, run.view(), true);
}

/** The run as saved, with its state changed, and carried on from there. */
export function edited(
  run: Run,
  content: Content,
  change: (state: {
    gauges: Record<string, number>;
    truth: { beliefs: Record<string, number> };
  }) => void,
): Run {
  const saved = JSON.parse(run.save()) as {
    state: Parameters<typeof change>[0];
  };
  change(saved.state);
  return resumeRun({ save: JSON.stringify(saved), content });
}

/** How the seat was decided on this seed, playing as `playThrough` does. */
export function decidedOn(seed: number, content: Content) {
  const run = startRun({ seed, content });
  const views = playThrough(run);
  const truth = readHiddenTruth(run);
  return { run, views, truth, decided: truth.vacancies[0]?.decided ?? null };
}

export const toldTitled = (views: PlayerView[], title: string) =>
  views.find((v) => v.step.kind === "notice" && v.step.title === title);
