import {
  resumeRun,
  startRun,
  type Choice,
  type Content,
  type Kind,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { fixtureRaw, floorOwn } from "./fixture";

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

const mistakes = {
  finalWarning: { title: "WARNED", body: "One more." },
  fired: { title: "FIRED", body: "That was one more." },
  firedOutright: { title: "FIRED-OUTRIGHT", body: "That was all it took." },
  demoted: { title: "DEMOTED", body: "{boss} HAS-YOUR-SEAT" },
  results: { title: "ENDED", intro: "It ended." },
  firedIn: "FIRED-IN {month}",
  finished: "LASTED",
};

export const certain = { believer: 1, incompetent: 1, practitioner: 1 };
export const never = { believer: 0, incompetent: 0, practitioner: 0 };
const evenly = { warm: 0, neutral: 0, cold: 0 };

const reaction = (word: string) => ({
  believer: `${word}-BELIEVER`,
  incompetent: `${word}-INCOMPETENT`,
  practitioner: `${word}-PRACTITIONER`,
});

/**
 * A Plan done by flags that start with `prefix`: really, which a Believer and an
 * Incompetent count; on paper, which an Incompetent and a Practitioner count;
 * or with whoever really has what it needs, Ben or Cal, which falls back on the
 * wrong figures without them.
 */
function plan(id: string, heardIn: string, prefix: string, blame = certain) {
  return {
    id,
    floor: "fixture-job",
    title: `${id.toUpperCase()}-TITLE`,
    what: `${id.toUpperCase()}-WHAT`,
    lasts: 2,
    heardIn: [heardIn],
    needs: {
      from: [
        { character: "ben", asked: `${prefix}asked-ben` },
        { character: "cal", asked: `${prefix}asked-cal` },
      ],
      told: "{who} HAD-IT",
    },
    ways: [
      {
        id: "really",
        how: "reality",
        when: { did: `${prefix}really-done` },
        counts: ["believer", "incompetent"],
        belief: { believer: 3, incompetent: 0, practitioner: 1 },
        reaction: reaction("REALLY"),
        sets: ["completed-plan"],
        done: { title: "DONE-REALLY", body: "It is really done." },
      },
      {
        id: "on-paper",
        how: "appearance",
        when: { did: `${prefix}looks-done` },
        counts: ["incompetent", "practitioner"],
        belief: { believer: -2, incompetent: 3, practitioner: 1 },
        reaction: reaction("ON-PAPER"),
        sets: ["completed-plan", "hollow-plan"],
        done: { title: "DONE-ON-PAPER", body: "It looks done." },
      },
      {
        id: "with-them",
        how: "reality",
        when: { did: `${prefix}done-with-them` },
        needs: true,
        otherwise: "wrong-figures",
        counts: ["believer", "incompetent", "practitioner"],
        belief: { believer: 3, incompetent: 1, practitioner: 2 },
        reaction: reaction("WITH-THEM"),
        sets: ["completed-plan"],
        done: { title: "DONE-WITH-THEM", body: "It is done with them." },
      },
      {
        id: "wrong-figures",
        how: "appearance",
        counts: ["incompetent"],
        belief: { believer: -1, incompetent: 1, practitioner: 0 },
        reaction: reaction("WRONG"),
        sets: ["completed-plan", "hollow-plan"],
        done: { title: "DONE-WRONG", body: "The figures were wrong." },
      },
    ],
    failed: {
      blame: {
        sticks: { not: { did: "kept-a-paper-trail" } },
        chance: blame,
        mood: evenly,
      },
      onPlayer: {
        id: `${id}-blamed-you`,
        as: "notice",
        title: "BLAMED-YOU",
        body: "It was you.",
        mistake: "big",
      },
      onSomeoneElse: {
        id: `${id}-blamed-them`,
        as: "notice",
        title: "BLAMED-THEM",
        body: "It was them.",
      },
    },
    results: {
      reality: "FATE-REALITY",
      appearance: "FATE-APPEARANCE",
      failed: "FATE-FAILED",
      running: "FATE-RUNNING",
    },
  };
}

const option = (id: string, ...sets: string[]) => ({ id, label: id, sets });

/**
 * Four months on the fixture's floor, with Ana the boss. In month 1 her Plan is
 * told, and in month 2 it can be done for real, on paper, with whoever has what
 * it needs, or not at all. It is due by the end of month 2. A second Plan, done
 * by flags of its own, is for whoever takes one on next.
 */
export function raw(blame = certain) {
  const base = fixtureRaw();
  base.balance.monthsPerRun = 4;
  return {
    ...base,
    mistakes,
    notifications: [
      {
        id: "plan-told",
        floor: "fixture-job",
        months: [1],
        from: "Your boss",
        subject: "My Grand Plan",
        body: "Here it is.",
        options: [
          option("noted"),
          option("ask-ben", "asked-ben"),
          option("ask-cal", "asked-cal"),
        ],
      },
      {
        id: "plan-work",
        floor: "fixture-job",
        months: [2],
        from: "Your boss",
        subject: "The Grand Plan",
        body: "Well?",
        options: [
          option("really", "really-done"),
          option("on-paper", "looks-done"),
          option("leave", "left-it"),
          option("with-them", "done-with-them"),
          option("paper-trail", "kept-a-paper-trail"),
        ],
      },
      {
        id: "next-told",
        floor: "fixture-job",
        when: { planRunning: "next-plan" },
        from: "Your new boss",
        subject: "My own Grand Plan",
        body: "Here is mine.",
        options: [option("noted-next")],
      },
      ...floorOwn(),
    ] as ReturnType<typeof fixtureRaw>["notifications"],
    risks: [
      {
        id: "hollow",
        addedBy: "hollow-plan",
        after: { min: 1, max: 1 },
        note: "HOLLOW-NOTE",
        route: { character: "ben", chance: certain, motive: "HOLLOW-MOTIVE" },
        traced: { did: "hollow-plan" },
        onPlayer: {
          id: "hollow-out",
          as: "notice",
          title: "HOLLOW-OUT",
          body: "It was empty.",
        },
        landedOnYou: "LANDED-ON-YOU",
        landedElsewhere: "LANDED-ELSEWHERE",
        neverCameOut: "NEVER-CAME-OUT",
      },
    ],
    standing: {
      label: "ON-PAPER",
      title: "How you would do on paper.",
      start: 50,
      reported: { good: 0, fair: 0, bad: 0 },
      finalWarning: 10,
      bands: [
        { from: 0, label: "RED", onPaper: "PAPER-RED" },
        { from: 34, label: "AMBER", onPaper: "PAPER-AMBER" },
        { from: 67, label: "GREEN", onPaper: "PAPER-GREEN" },
      ],
      deeds: [{ flag: "completed-plan", by: 20 }],
      decides: "DECIDED-BY {who}",
    },
    grandPlans: {
      statuses: {
        running: "RUNNING-TO-{month}",
        completed: "COMPLETED",
        failed: "FAILED",
      },
      dropped: "DROPPED",
      formerBoss: "FORMER-BOSS-DONE",
      plans: [
        plan("big-plan", "plan-told", "", blame),
        plan("next-plan", "next-told", "next-"),
      ],
    },
  };
}

/** Plays on, answering with these where they are offered, and otherwise the first choice. */
export function play(run: Run, ...answers: string[]): PlayerView[] {
  let view = run.view();
  const views = [view];
  while (view.choices.length > 0) {
    const { step } = view;
    const wanted =
      step.kind === "notification"
        ? step.options.find((o) => answers.includes(o.id))
        : undefined;
    const choice: Choice =
      step.kind === "notification" && wanted
        ? { type: "notification", notificationId: step.id, optionId: wanted.id }
        : (view.choices[0] as Choice);
    view = run.choose(choice);
    views.push(view);
  }
  return views;
}

export const answer = (notificationId: string, optionId: string): Choice => ({
  type: "notification",
  notificationId,
  optionId,
});

export const titled = (views: PlayerView[], title: string) =>
  views.find(
    (v) =>
      (v.step.kind === "notice" || v.step.kind === "move") &&
      v.step.title === title,
  );

/** The months in which the player was told this. */
export const toldIn = (views: PlayerView[], title: string) =>
  views
    .filter(
      (v) =>
        (v.step.kind === "notice" || v.step.kind === "move") &&
        v.step.title === title,
    )
    .map((v) => v.month);

/** The boss, whom the fixture makes Ana, dealt as this kind on some seed. */
export function seedWhereBossIs(kind: Kind, content: Content): number {
  const seed = SEEDS.find(
    (s) =>
      readHiddenTruth(startRun({ seed: s, content })).characters.find(
        (c) => c.id === "ana",
      )?.kind === kind,
  );
  if (seed === undefined) throw new Error(`No seed deals a ${kind} boss.`);
  return seed;
}

/** Plays on, taking the first choice, until a Notification with this id. */
export function untilNotification(run: Run, id: string): PlayerView {
  let view = run.view();
  while (view.step.kind !== "notification" || view.step.id !== id) {
    view = run.choose(view.choices[0] as Choice);
  }
  return view;
}

/** Hears of the Plan in month 1 with this, and answers month 2's Notification with that. */
export function completed(
  seed: number,
  content: Content,
  optionId: string,
  told = "noted",
) {
  const run = startRun({ seed, content });
  run.choose(answer("plan-told", told));
  let view = untilNotification(run, "plan-work");
  const before = readHiddenTruth(run).bossBelief;
  const standingBefore = view.standing?.at;
  view = run.choose(answer("plan-work", optionId));
  // What the player is told of the Plan follows what the choice itself says.
  while (view.step.kind !== "notice" || !view.step.title.startsWith("DONE")) {
    view = run.choose(view.choices[0] as Choice);
  }
  return {
    run,
    view,
    shift: readHiddenTruth(run).bossBelief - before,
    standingShift: (view.standing?.at ?? 0) - (standingBefore ?? 0),
  };
}

/** The run as saved, with the player moved to answer to someone else. */
export function movePlayer(run: Run, content: Content, to: string): Run {
  const saved = JSON.parse(run.save()) as {
    state: { reportsTo: Record<string, string> };
  };
  saved.state.reportsTo.you = to;
  return resumeRun({ save: JSON.stringify(saved), content });
}
