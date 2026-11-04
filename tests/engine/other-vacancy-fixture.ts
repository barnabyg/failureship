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
import { edited, vacancyRaw, type Editable } from "./vacancy-fixture";

const perKind = (n: number) => ({
  believer: n,
  incompetent: n,
  practitioner: n,
});
const perKindLines = (line: string) => ({
  believer: [`{who} ${line} {what}`],
  incompetent: [`{who} ${line} {what}`],
  practitioner: [`{who} ${line} {what}`],
});

/**
 * The seat fixture, with other ways for Ana's seat to fall vacant, all in month
 * 1, so that it is open in month 2 and decided as it closes. Burning Ana twice
 * makes a Believer of her leave as month 2 opens, so her seat opens in month 3.
 * Reporting her is up to whoever holds influence over her, at `chance`; it
 * adds a risk that comes out through Ben in month 2 and is traced to the
 * player, which is a big mistake. A Company Event can second her upstairs or
 * create a post out of her team in month 1.
 */
export function otherRaw(chance = 1, vacates?: "movedUp" | "created") {
  const base = vacancyRaw();
  const burn = {
    character: "{boss}",
    about: "burn",
    text: "BURNED",
    tone: "bad",
  };
  // Burns that would make a whistleblower of a Believer, not someone who leaves.
  const sour = { ...burn, about: "sour", text: "SOURED" };
  return {
    ...base,
    notifications: [
      {
        id: "get-rid",
        floor: "fixture-job",
        months: [1],
        from: "People",
        subject: "GET-RID",
        body: "Your boss?",
        options: [
          { id: "keep-quiet", label: "Keep quiet" },
          { id: "burn", label: "Burn your boss", remembers: [burn, burn] },
          {
            id: "report-boss",
            label: "Report your boss",
            sets: ["moved-against-the-boss"],
            ousts: "report",
          },
          {
            id: "nominate-boss",
            label: "Nominate your boss for a post upstairs",
            ousts: "upstairs",
          },
          {
            id: "promise-and-report",
            label: "Promise your boss something, and then report them",
            promise: "word-to-boss",
            ousts: "report",
          },
          {
            id: "burn-peers-and-report",
            label: "Burn your peers, and then report your boss",
            remembers: [
              { ...burn, character: "ben" },
              { ...burn, character: "ben" },
              { ...burn, character: "cal" },
              { ...burn, character: "cal" },
            ],
            ousts: "report",
          },
          {
            id: "ask-about-ana",
            label: "Ask whether what you heard of your boss is true",
            requires: { heardOf: { fact: "fact-a", character: "{boss}" } },
            ousts: "fact",
          },
          {
            id: "sour-and-report",
            label: "Sour your boss, and then report them",
            remembers: [sour, sour],
            ousts: "report",
          },
        ],
      },
      ...base.notifications,
    ],
    promises: {
      belief: {
        chance: perKind(1),
        mood: { warm: 0, neutral: 0, cold: 0 },
        perBroken: 0.5,
        perKept: 0.2,
      },
      replies: {
        believed: perKindLines("BELIEVES"),
        doubted: perKindLines("DOUBTS"),
        letDown: ["LET-DOWN"],
        heard: ["{who} HEARD {victim} {what}"],
      },
      broken: { about: "broke", text: "BROKE {victim} {what}", perTie: 1 },
      kept: { about: "kept", text: "KEPT {victim} {what}" },
      statuses: {
        open: "OPEN",
        kept: "KEPT",
        broken: "BROKEN",
        refused: "REFUSED",
        lapsed: "LAPSED",
      },
      items: [
        {
          id: "word-to-boss",
          to: "{boss}",
          title: "WORD",
          what: "WHAT-WORD",
          after: { min: 2, max: 2 },
          due: {
            from: "Them",
            subject: "DUE",
            body: "It has fallen due.",
            options: [
              { id: "keep-word", label: "Keep it", settles: "kept" },
              { id: "break-word", label: "Break it", settles: "broken" },
            ],
          },
        },
      ],
    },
    vacancies: {
      ...base.vacancies,
      ousting: {
        ways: {
          report: { chance: perKind(chance) },
          // A Practitioner above the boss buries it; anyone else acts on it,
          // if it is true.
          fact: {
            chance: { believer: 1, incompetent: 1, practitioner: 0 },
            when: { heardTrue: "fact-a" },
          },
          upstairs: {
            chance: perKind(chance),
            upstairs: true,
            gone: { title: "BOSS-UPSTAIRS", body: "{holder} KICKED-UPSTAIRS" },
          },
        },
        sets: ["got-rid-of-a-boss"],
        mood: { warm: 0, neutral: 0, cold: 0 },
        gone: { title: "BOSS-GONE", body: "{holder} HAS-GONE" },
        survived: { title: "BOSS-STAYS", body: "{holder} STAYS" },
        remembered: {
          about: "tried-to-get-rid-of-me",
          text: "TRIED-TO-GET-RID-OF-ME",
          belief: -5,
        },
      },
    },
    risks: [
      ...base.risks,
      {
        id: "traced-to-you",
        addedBy: "moved-against-the-boss",
        after: { min: 1, max: 1 },
        note: "TRACED-NOTE",
        route: { character: "ben", chance: perKind(1), motive: "BEN-SAW" },
        traced: { did: "moved-against-the-boss" },
        onPlayer: {
          id: "traced-landed",
          as: "notice",
          title: "IT-WAS-YOU",
          body: "It was you.",
          mistake: "big",
        },
        landedOnYou: "LANDED-ON-YOU",
        landedElsewhere: "LANDED-ELSEWHERE",
        neverCameOut: "NEVER-CAME-OUT",
      },
    ],
    changing: {
      threshold: 2,
      burns: [
        {
          about: "burn",
          weight: 1,
          why: "WHY-BURNED",
          leans: { practitioner: 0, whistleblower: 0, left: 1 },
        },
        {
          about: "sour",
          weight: 1,
          why: "WHY-SOURED",
          leans: { practitioner: 0, whistleblower: 1, left: 0 },
        },
      ],
      became: {
        practitioner: "BECAME-PRACTITIONER",
        whistleblower: "BECAME-WHISTLEBLOWER",
        left: "BECAME-LEFT",
      },
      whistleblower: {
        share: 0.6,
        signs: [{ id: "file", text: "{who} KEEPS-A-FILE", weight: 1 }],
        motive: "{who} WENT-UPSTAIRS",
        reports: [
          {
            bill: {
              id: "reported",
              as: "notice",
              title: "REPORTED",
              body: "Someone reported you.",
            },
          },
        ],
      },
      leaving: {
        ana: {
          cover: "the acting boss",
          notice: { title: "ANA-LEFT", body: "The boss has gone." },
        },
        ben: {
          cover: "the temp",
          notice: { title: "BEN-LEFT", body: "The analyst has gone." },
        },
        cal: {
          cover: "the interim",
          notice: { title: "CAL-LEFT", body: "The clerk has gone." },
        },
      },
    },
    events: vacates
      ? [
          {
            id: "shake-up",
            floor: "fixture-job",
            from: "The Board",
            title: "SHAKE-UP",
            body: "Things are changing.",
            changed: "SHAKE-UP-CHANGED",
            schedule: { months: [1], chance: 1 },
            vacates,
            story: { reported: "SHAKE-UP-REPORTED" },
          },
        ]
      : [],
  };
}

export function otherFixture(
  chance = 1,
  vacates?: "movedUp" | "created",
): Content {
  return parseContent(otherRaw(chance, vacates));
}

/** Plays on with this answer to month 1's question about the boss, and the first choice otherwise. */
export function playWith(run: Run, optionId: string): PlayerView[] {
  let view = run.view();
  const views = [view];
  while (view.choices.length > 0) {
    const { step } = view;
    const choice: Choice =
      step.kind === "notification" && step.id === "get-rid"
        ? answer("get-rid", optionId)
        : (view.choices[0] as Choice);
    view = run.choose(choice);
    views.push(view);
  }
  return views;
}

/** A run with every Character dealt this kind, as if dealt so. */
export function allOfKind(seed: number, content: Content, kind: Kind): Run {
  const run = startRun({ seed, content });
  return edited(run, content, (state: Editable) => {
    for (const dealt of state.truth.characters) dealt.kind = kind;
  });
}

/** Whoever held influence over Ana on the Power Map as the run started. */
export function aboveAna(seed: number, content: Content): string | undefined {
  const map = readHiddenTruth(startRun({ seed, content })).powerMap;
  return map.influence.find((i) => i.over === "ana")?.who;
}
