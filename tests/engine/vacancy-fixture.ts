import {
  parseContent,
  resumeRun,
  startRun,
  type Choice,
  type Content,
  type Kind,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth, type PowerMap } from "../../src/engine/hidden-truth";
import { answer, raw as planRaw } from "./grand-plan-fixture";
import { room } from "./fixture";

/** A reason that weighs this much with a Believer, an Incompetent and a Practitioner. */
const reason = (
  [believer, incompetent, practitioner]: [number, number, number],
  why: string,
  told?: string,
) => ({
  weight: { believer, incompetent, practitioner },
  why,
  ...(told === undefined ? {} : { told }),
});

const seatTalk = (id: string, seat: Record<string, unknown>) => ({
  id,
  label: id,
  seat,
  result: { title: "SEAT-TALK", body: "You talked about the seat." },
});

/**
 * The Grand Plan fixture, with a seat to fill. Ana is the boss, under Dee, and
 * Ben and Cal are the player's peers. Eve, at the top, is written for the floor
 * above, which has a desk of its own. Done for real in month 2, Ana's Plan
 * counts with every kind of boss, so her seat is open in month 3 and decided as
 * it closes. In month 3 the player can talk to someone about it. Warm beats
 * anything but a decider choosing themselves. A Believer weighs a Plan really
 * delivered above a protégé, and a Practitioner a protégé above a Plan.
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
      {
        id: "seat-talk",
        floor: "fixture-job",
        when: { vacancyOpen: true },
        from: "People",
        subject: "THE-SEAT-IS-OPEN",
        body: "Talk to someone?",
        options: [
          { id: "wait", label: "Wait" },
          seatTalk("approach-dee", { approach: "dee" }),
          seatTalk("approach-ben", { approach: "ben" }),
          seatTalk("approach-cal", { approach: "cal" }),
          seatTalk("call-in", { callIn: true }),
          seatTalk("claim", { credit: true }),
        ],
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
        when: {
          remembers: { character: "ben", about: "lost-the-seat-to-you" },
        },
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
      you: "YOU-IN-WORDS",
      passedOver: {
        forYou: {
          about: "lost-the-seat-to-you",
          text: "PASSED-OVER-FOR {winner}",
          tone: "bad",
        },
        forSomeoneElse: {
          about: "lost-the-seat",
          text: "PASSED-OVER-FOR {winner}",
        },
      },
      reasons: {
        self: reason([9, 9, 9], "SELF:{who}", "TOLD-SELF:{who}"),
        owed: reason([1, 1, 6], "OWED:{decider}>{who}", "TOLD-OWED:{who}"),
        protege: reason(
          [2, 2, 5],
          "PROTEGE:{decider}>{who}",
          "TOLD-PROTEGE:{who}",
        ),
        circle: reason([1, 1, 1], "CIRCLE:{decider}>{who}"),
        credited: reason([0, 4, 1], "CREDITED:{who}", "TOLD-CREDITED:{who}"),
        owedYou: reason([1, 1, 2], "OWED-YOU:{decider}"),
        calledIn: reason([1, 1, 7], "CALLED-IN:{decider}", "TOLD-CALLED-IN"),
        delivered: reason([5, 0, 1], "DELIVERED", "TOLD-DELIVERED"),
        results: reason([2, 0, 0], "RESULTS"),
        looks: reason([0, 3, 0], "LOOKS"),
        warm: reason([6, 6, 6], "WARM:{decider}"),
        neutral: reason([1, 1, 1], "NEUTRAL:{decider}"),
        cold: reason([0, 0, 0], "COLD:{decider}"),
      },
      resultsAt: 99,
      looksAt: 99,
      acts: {
        approach: {
          decider: { text: "APPROACHED", belief: 9 },
          sway: { text: "A-WORD-FROM-SOMEONE", belief: 9 },
        },
        callIn: { sway: { text: "A-FAVOUR-CALLED-IN", belief: 9 } },
        story: { text: "A-STORY-ABOUT-YOU", belief: -9 },
        diary: "A-LONG-LUNCH",
      },
      close: "CLOSE:{who}",
      untold: "UNTOLD:{decider}",
      inFact: "DECIDED-BY:{decider} {why}",
      asForYou: "FOR-YOU: {why}",
      results: "{holder} SEAT WENT TO {winner} IN {month}",
    },
  };
}

export function vacancyFixture(): Content {
  return parseContent(vacancyRaw());
}

/** The same, with a competitor's Move for the seat that lands while it is open. */
export function withSeatMove(seat: Record<string, unknown>): Content {
  const raw = vacancyRaw();
  return parseContent({
    ...raw,
    moves: [
      ...raw.moves,
      {
        id: "for-the-seat",
        from: "Someone",
        by: "{competitor}",
        priority: true,
        when: { vacancyOpen: true },
        title: "FOR-THE-SEAT",
        body: "{competitor} WANTS-IT",
        seat,
      },
    ],
  });
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

/** What a test can change of a saved run. */
export interface Editable {
  gauges: Record<string, number>;
  truth: {
    beliefs: Record<string, number>;
    powerMap: PowerMap;
    characters: { id: string; kind: Kind }[];
  };
}

/** The run as saved, with its state changed, and carried on from there. */
export function edited(
  run: Run,
  content: Content,
  change: (state: Editable) => void,
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
