import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  ContentError,
  parseContent,
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { fixtureRaw } from "./fixture";

const mistakes = {
  finalWarning: { title: "WARNED", body: "One more." },
  fired: { title: "FIRED", body: "That was one more." },
  firedOutright: { title: "FIRED-OUTRIGHT", body: "That was all it took." },
  results: { title: "ENDED", intro: "It ended." },
  firedIn: "FIRED-IN {month}",
  finished: "LASTED",
};

const certain = { believer: 1, incompetent: 1, practitioner: 1 };

function raw(risk: object = {}) {
  const base = fixtureRaw();
  base.balance.monthsPerRun = 4;
  base.notifications = [
    {
      id: "budget",
      months: [1],
      from: "Finance",
      subject: "A budget",
      body: "Cut what?",
      options: [
        { id: "cut", label: "Cut it", sets: ["cut-it"] },
        { id: "keep", label: "Keep it" },
      ],
    },
    {
      id: "tidy",
      months: [2],
      from: "IT",
      subject: "Tidy up",
      body: "Tidy up?",
      options: [
        { id: "cover", label: "Cover it", sets: ["covered"] },
        { id: "leave", label: "Leave it" },
      ],
    },
  ];
  return {
    ...base,
    mistakes,
    risks: [
      {
        id: "r",
        addedBy: "cut-it",
        after: { min: 2, max: 2 },
        note: "RISK-NOTE",
        route: { character: "ben", chance: certain, motive: "RISK-MOTIVE" },
        traced: { not: { did: "covered" } },
        onPlayer: {
          id: "on-you",
          as: "notice",
          title: "ON-YOU",
          body: "It is you.",
          mistake: "big",
        },
        onSomeoneElse: {
          id: "on-them",
          as: "notice",
          title: "ON-THEM",
          body: "It is them.",
        },
        landedOnYou: "LANDED-ON-YOU",
        landedElsewhere: "LANDED-ELSEWHERE",
        neverCameOut: "NEVER-CAME-OUT",
        ...risk,
      },
    ],
  };
}

function play(run: Run, ...answers: string[]): PlayerView[] {
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

const titled = (views: PlayerView[], title: string) =>
  views.find((v) => v.step.kind === "notice" && v.step.title === title);

function risksOf(views: PlayerView[]) {
  const { step } = views.at(-1) as PlayerView;
  if (step.kind !== "results") throw new Error(step.kind);
  return step.risks;
}

describe("a hidden risk", () => {
  const content = parseContent(raw());

  it("surfaces later, and lands on the player if it can be traced to them", () => {
    const views = play(startRun({ seed: 1, content }), "cut", "leave");

    expect(titled(views, "ON-YOU")?.month).toBe(3);
    expect(titled(views, "ON-THEM")).toBeUndefined();
  });

  it("lands on someone else if the player has covered their tracks", () => {
    const views = play(startRun({ seed: 1, content }), "cut", "cover");

    expect(titled(views, "ON-YOU")).toBeUndefined();
    expect(titled(views, "ON-THEM")?.month).toBe(3);
    expect(views.at(-1)?.finalWarning).toBe(false);
  });

  it("comes to nothing if it cannot be traced and nothing else is written", () => {
    const quiet = parseContent(raw({ onSomeoneElse: undefined }));

    const views = play(startRun({ seed: 1, content: quiet }), "cut", "cover");

    expect(titled(views, "ON-YOU")).toBeUndefined();
    expect(risksOf(views)[0]?.fate).toBe("LANDED-ELSEWHERE");
  });

  it("is added only by the choice that builds it up", () => {
    const run = startRun({ seed: 1, content });
    const views = play(run, "keep", "leave");

    expect(readHiddenTruth(run).risks).toEqual([]);
    expect(risksOf(views)).toEqual([]);
  });

  it("can be a big mistake when it lands", () => {
    const views = play(startRun({ seed: 1, content }), "cut", "leave");

    expect(views.at(-1)?.finalWarning).toBe(true);
  });

  it("needs a Character with the motive to act", () => {
    const none = { believer: 0, incompetent: 0, practitioner: 0 };
    const unmoved = parseContent(
      raw({ route: { character: "ben", chance: none, motive: "M" } }),
    );

    const views = play(startRun({ seed: 1, content: unmoved }), "cut", "leave");

    expect(titled(views, "ON-YOU")).toBeUndefined();
    expect(risksOf(views)[0]).toMatchObject({
      cameOutIn: null,
      fate: "NEVER-CAME-OUT",
    });
  });

  it("needs a Character with the means to act", () => {
    const helpless = parseContent(
      raw({
        route: {
          character: "ben",
          chance: certain,
          motive: "M",
          means: { did: "never-set" },
        },
      }),
    );

    const views = play(
      startRun({ seed: 1, content: helpless }),
      "cut",
      "leave",
    );

    expect(titled(views, "ON-YOU")).toBeUndefined();
  });

  it("depends on the Character's dealt kind", () => {
    const onlyBelievers = parseContent(
      raw({
        route: {
          character: "ben",
          chance: { believer: 1, incompetent: 0, practitioner: 0 },
          motive: "M",
        },
      }),
    );
    for (let seed = 0; seed < 30; seed++) {
      const run = startRun({ seed, content: onlyBelievers });
      const views = play(run, "cut", "leave");
      const ben = readHiddenTruth(run).characters.find((c) => c.id === "ben");

      expect(titled(views, "ON-YOU") !== undefined).toBe(
        ben?.kind === "believer",
      );
    }
  });

  it("gives the same result for the same seed and choices", () => {
    const seeded = parseContent(
      raw({
        route: {
          character: "ben",
          chance: { believer: 0.5, incompetent: 0.5, practitioner: 0.5 },
          motive: "M",
        },
        after: { min: 1, max: 3 },
      }),
    );
    for (let seed = 0; seed < 20; seed++) {
      const once = play(startRun({ seed, content: seeded }), "cut", "leave");
      const again = play(startRun({ seed, content: seeded }), "cut", "leave");

      expect(JSON.stringify(again)).toBe(JSON.stringify(once));
    }
  });

  it("never shows in the player view until it comes out", () => {
    const run = startRun({ seed: 1, content });
    const views = play(run, "cut", "leave");
    const before = views.filter(
      (v) => v.month < 3 && v.step.kind !== "results",
    );

    expect(before.length).toBeGreaterThan(0);
    for (const view of before) {
      const said = JSON.stringify(view);
      for (const word of ["RISK-NOTE", "RISK-MOTIVE", "ON-YOU", "risk"]) {
        expect(said.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
  });

  it("is listed on the results screen, whether or not it came out", () => {
    const landed = play(startRun({ seed: 1, content }), "cut", "leave");

    expect(risksOf(landed)).toEqual([
      {
        addedIn: 1,
        note: "RISK-NOTE",
        motive: "RISK-MOTIVE",
        cameOutIn: 3,
        fate: "LANDED-ON-YOU",
      },
    ]);
  });
});

describe("what a Character remembers", () => {
  const rawWithMemory = () => {
    const base = raw();
    const budget = base.notifications[0];
    if (budget?.options[0]) {
      (budget.options[0] as { remembers?: object[] }).remembers = [
        { character: "ben", about: "passed-over", text: "MEMORY-WORDS" },
      ];
    }
    return {
      ...base,
      threads: [
        {
          id: "t",
          startedBy: "cut-it",
          after: { min: 2, max: 2 },
          started: "S",
          outcomes: [
            {
              when: { remembers: { character: "ben", about: "passed-over" } },
              playedOut: "P",
              bill: { id: "b", as: "notice", title: "REMEMBERED", body: "B" },
            },
          ],
        },
      ],
    };
  };

  it("brings a Budget decision back through a Thread", () => {
    const content = parseContent(rawWithMemory());
    const run = startRun({ seed: 1, content });

    const views = play(run, "cut", "leave");

    expect(titled(views, "REMEMBERED")?.month).toBe(3);
    expect(readHiddenTruth(run).memories).toEqual([
      {
        character: "ben",
        about: "passed-over",
        text: "MEMORY-WORDS",
        month: 1,
      },
    ]);
  });

  it("is refused for a Character who does not exist", () => {
    const base = rawWithMemory();
    const budget = base.notifications[0];
    if (budget?.options[0]) {
      (budget.options[0] as { remembers?: object[] }).remembers = [
        { character: "nobody", about: "x", text: "T" },
      ];
    }
    expect(() => parseContent(base)).toThrow(ContentError);
  });
});

describe("what is written", () => {
  it("refuses a risk that nothing adds", () => {
    expect(() => parseContent(raw({ addedBy: "nothing-sets-this" }))).toThrow(
      ContentError,
    );
  });

  it("refuses a route through nobody", () => {
    expect(() =>
      parseContent(
        raw({ route: { character: "nobody", chance: certain, motive: "M" } }),
      ),
    ).toThrow(ContentError);
  });
});

describe("the real risks", () => {
  it("lets a one-off Budget add a hidden risk", () => {
    const budgetRound = gameContent.scenes.find((s) => s.id === "budget-round");
    const flags = budgetRound?.options.flatMap((o) =>
      o.results.flatMap((r) => r.sets),
    );

    expect(gameContent.risks.some((r) => flags?.includes(r.addedBy))).toBe(
      true,
    );
  });

  it("lets the player change whether a risk can be traced", () => {
    const covering = gameContent.notifications.flatMap((n) =>
      n.options.flatMap((o) => o.sets),
    );

    for (const risk of gameContent.risks) {
      expect(JSON.stringify(risk.traced)).toContain("covered-tracks");
    }
    expect(covering).toContain("covered-tracks");
  });

  it("can land as a big mistake", () => {
    expect(gameContent.risks.some((r) => r.onPlayer.mistake === "big")).toBe(
      true,
    );
  });

  it("brings the bonus pot back through what a Character remembers", () => {
    const thread = gameContent.threads.find((t) => t.id === "bonus-remembered");

    expect(thread?.outcomes.every((o) => o.when && "remembers" in o.when)).toBe(
      true,
    );
  });
});
