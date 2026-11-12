import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  ContentError,
  parseContent,
  startRun,
  type Choice,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { everyBill } from "../../src/engine/content";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice, playToMonth } from "../../src/ui/later-month";
import { fixtureRaw, floorOwn } from "./fixture";

const certain = { believer: 1, incompetent: 1, practitioner: 1 };

const rules = {
  gauge: "teflon",
  by: 10,
  failed: { by: -10, note: 'STUCK "{what}"' },
  blamed: { about: "blamed-for-yours", text: 'BLAMED for "{what}"', warm: -3 },
  why: {
    dangerous: "DANGEROUS {name}: {fact}",
    lie: "LIE-SEEN",
    bet: "BET-LOST",
    warm: "WARM {name}",
    rival: "RIVAL {name}",
  },
  kinds: { blame: "BLAMED", lie: "LIED", bury: "BURIED", take: "TOOK" },
};

const escapes = [
  {
    id: "blame-cal",
    kind: "blame",
    label: "BLAME-CAL",
    blames: "cal",
    worked: {
      body: "CAL-TOOK-IT",
      reported: "REPORTED-SOMEONE-IN-FACILITIES",
      happened: "HAPPENED-YOU-BLAMED-CAL",
    },
    failed: { body: "CAL-HIT-BACK", opinion: -2 },
  },
  {
    id: "deny-it",
    kind: "lie",
    label: "DENY-IT",
    worked: { body: "DENIED", reported: "R-DENIED", happened: "H-DENIED" },
    failed: { body: "NOT-BELIEVED", opinion: -2, mistake: "big" },
  },
  {
    id: "lose-it",
    kind: "bury",
    label: "LOSE-IT",
    fails: { flag: "never-set" },
    worked: { body: "LOST", reported: "R-LOST", happened: "H-LOST" },
    failed: { body: "FOUND", why: "WHY-FOUND", headOpinion: -1 },
  },
  { id: "take-it", kind: "take", label: "TAKE-IT", body: "TAKEN" },
];

/** A run in which a risk the player builds in month 1 lands on them in month 3. */
function raw(onPlayer: object = {}) {
  const base = fixtureRaw();
  base.balance.monthsPerRun = 4;
  base.hiddenTruth.facts = [
    {
      id: "fact-a",
      text: "SECRET-ALPHA about {name}",
      characters: ["cal"],
      nature: "dangerous",
    },
    { id: "fact-b", text: "SECRET-BRAVO about {name}" },
    { id: "fact-c", text: "SECRET-CHARLIE about {name}" },
  ] as typeof base.hiddenTruth.facts;
  base.notifications = [
    {
      id: "budget",
      floor: "fixture-job",
      months: [1],
      from: "Finance",
      subject: "A budget",
      body: "Cut what?",
      options: [{ id: "cut", label: "Cut it", sets: ["cut-it"] }],
    },
    ...floorOwn(),
  ];
  return {
    ...base,
    mistakes: {
      finalWarning: { title: "WARNED", body: "One more." },
      fired: { title: "FIRED", body: "That was one more." },
      firedOutright: { title: "FIRED-OUTRIGHT", body: "That was all." },
      results: { title: "ENDED", intro: "It ended." },
      firedIn: "FIRED-IN {month}",
      finished: "LASTED",
    },
    gauges: [
      {
        id: "teflon",
        label: "Teflon",
        start: 50,
        min: 0,
        max: 100,
        milestones: [],
      },
    ],
    escapes: rules,
    risks: [
      {
        id: "r",
        addedBy: "cut-it",
        after: { min: 2, max: 2 },
        note: "RISK-NOTE",
        route: { character: "ben", chance: certain, motive: "RISK-MOTIVE" },
        traced: { not: { flag: "never-set-either" } },
        onPlayer: {
          id: "on-you",
          as: "move",
          from: "Ben",
          title: "ON-YOU",
          body: "It is you.",
          sets: ["landed-on-you"],
          opinion: -1,
          escapes,
          ...onPlayer,
        },
        landedOnYou: "LANDED-ON-YOU",
        landedElsewhere: "LANDED-ELSEWHERE",
        neverCameOut: "NEVER-CAME-OUT",
      },
    ],
  };
}

/** Plays a run through, choosing this way out when offered, and the first of anything else. */
function play(run: Run, escape: string): PlayerView[] {
  let view = run.view();
  const views = [view];
  while (view.choices.length > 0) {
    const { step } = view;
    const choice: Choice =
      step.kind === "escape"
        ? { type: "escape", billId: step.id, escapeId: escape }
        : (view.choices[0] as Choice);
    view = run.choose(choice);
    views.push(view);
  }
  return views;
}

const teflon = (view: PlayerView | undefined) =>
  view?.gauges.find((g) => g.id === "teflon")?.value;

function escapesOf(views: PlayerView[]) {
  const { step } = views.at(-1) as PlayerView;
  if (step.kind !== "results") throw new Error(step.kind);
  return step.escapes;
}

/** Seeds on which Cal was dealt the dangerous Hidden Fact, or was not. */
function seedsWhere(content: Content, dangerous: boolean): number[] {
  return Array.from({ length: 40 }, (_, i) => i + 1).filter((seed) => {
    const truth = readHiddenTruth(startRun({ seed, content }));
    const cal = truth.characters.find((c) => c.id === "cal");
    return (cal?.fact?.id === "fact-a") === dangerous;
  });
}

function bossKind(content: Content, seed: number) {
  return readHiddenTruth(startRun({ seed, content })).characters.find(
    (c) => c.id === "ana",
  )?.kind;
}

describe("an Escape", () => {
  const content = parseContent(raw());
  const [dangerous] = seedsWhere(content, true);
  const [safe] = seedsWhere(content, false);

  it("is offered as a consequence of the player's own doing lands, in place of the Move", () => {
    const views = play(startRun({ seed: 1, content }), "take-it");
    const offered = views.find((v) => v.step.kind === "escape");

    expect(offered?.month).toBe(3);
    expect(offered?.step).toMatchObject({
      kind: "escape",
      title: "ON-YOU",
      escapes: escapes.map(({ id, label }) => ({ id, label })),
    });
    expect(offered?.choices).toHaveLength(escapes.length);
    expect(views.some((v) => v.step.kind === "move")).toBe(false);
  });

  it("taken, lands the consequence as written, and raises nothing", () => {
    const run = startRun({ seed: 1, content });
    const views = play(run, "take-it");
    const after = views.find(
      (v) => v.result?.kind === "happened" && v.result.title === "ON-YOU",
    );

    expect(after?.result).toMatchObject({ title: "ON-YOU", body: "TAKEN" });
    expect(teflon(views.at(-1))).toBe(50);
    expect(escapesOf(views)).toEqual([]);
    expect(readHiddenTruth(run).bossBelief).toBeLessThan(0);
  });

  it("fails when it names a Character with a dangerous Hidden Fact, and is worse than taking it", () => {
    expect(dangerous).toBeDefined();
    const seed = dangerous ?? 0;
    const blamed = startRun({ seed, content });
    const views = play(blamed, "blame-cal");
    const taken = startRun({ seed, content });
    play(taken, "take-it");

    const truth = readHiddenTruth(blamed);
    const cal = truth.characters.find((c) => c.id === "cal");
    expect(cal?.fact?.id).toBe("fact-a");
    expect(escapesOf(views)).toEqual([
      {
        month: 3,
        title: "ON-YOU",
        label: "BLAME-CAL",
        kind: "BLAMED",
        worked: false,
        why: [`DANGEROUS Cal Cope: ${cal?.fact?.text ?? ""}`],
      },
    ]);
    expect(
      views.some(
        (v) =>
          v.result?.kind === "happened" && v.result.body === "CAL-HIT-BACK",
      ),
    ).toBe(true);
    expect(truth.bossBelief).toBeLessThan(readHiddenTruth(taken).bossBelief);
    // Failing lowers Teflon, and the story says why.
    expect(teflon(views.at(-1))).toBe(40);
    const story = views.find((v) => v.step.kind === "story" && v.month === 3);
    expect(story?.step).toMatchObject({
      gauges: ['Teflon -10. STUCK "ON-YOU"'],
    });
  });

  it("works when whoever it names has nothing on the player: Teflon rises, and the story reports it", () => {
    expect(safe).toBeDefined();
    const run = startRun({ seed: safe ?? 0, content });
    const views = play(run, "blame-cal");
    const story = views.find((v) => v.step.kind === "story" && v.month === 3);
    const truth = readHiddenTruth(run);

    expect(escapesOf(views)[0]).toMatchObject({ worked: true });
    expect(escapesOf(views)[0]?.why[0]).toBe("HAPPENED-YOU-BLAMED-CAL");
    expect(teflon(views.at(-1))).toBe(60);
    expect(story?.step).toMatchObject({
      pairs: expect.arrayContaining([
        {
          reported: "REPORTED-SOMEONE-IN-FACILITIES",
          happened: "HAPPENED-YOU-BLAMED-CAL",
        },
      ]) as unknown,
    });
    // The consequence went elsewhere, and Cal keeps what was put on them.
    expect(truth.bossBelief).toBe(0);
    expect(
      truth.memories.some(
        (m) =>
          m.character === "cal" &&
          m.about === "blamed-for-yours" &&
          m.text === 'BLAMED for "ON-YOU"',
      ),
    ).toBe(true);
  });

  it("as a lie, fails to a Believer boss who saw it, and works on anyone else", () => {
    const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
    const believer = seeds.find((s) => bossKind(content, s) === "believer");
    const other = seeds.find((s) => bossKind(content, s) !== "believer");

    const lied = play(startRun({ seed: believer ?? 0, content }), "deny-it");
    expect(escapesOf(lied)[0]).toMatchObject({
      worked: false,
      why: ["LIE-SEEN"],
    });
    // Failing can be a big mistake, where the content says so.
    expect(lied.at(-1)?.finalWarning).toBe(true);

    const got = play(startRun({ seed: other ?? 0, content }), "deny-it");
    expect(escapesOf(got)[0]).toMatchObject({ worked: true });
    expect(got.at(-1)?.finalWarning).toBe(false);
  });

  it("fails for the reason written, when what it reads holds", () => {
    const found = parseContent(
      raw({
        escapes: escapes.map((e) =>
          e.id === "lose-it" ? { ...e, fails: { did: "cut-it" } } : e,
        ),
      }),
    );
    const views = play(startRun({ seed: 1, content: found }), "lose-it");

    expect(escapesOf(views)[0]).toMatchObject({
      worked: false,
      why: ["WHY-FOUND"],
    });
  });
});

describe("an Escape with a minimum Teflon", () => {
  /** The fixture with a minimum Teflon on lose-it, and Teflon starting where written. */
  function gated(start: number) {
    const base = raw({
      escapes: escapes.map((e) =>
        e.id === "lose-it" ? { ...e, minTeflon: 60 } : e,
      ),
    });
    return parseContent({
      ...base,
      gauges: base.gauges.map((g) => ({ ...g, start })),
    });
  }

  /** The view where the consequence lands, played plainly until then. */
  function offered(content: Content): { run: Run; view: PlayerView } {
    const run = startRun({ seed: 1, content });
    let view = run.view();
    while (view.step.kind !== "escape" && view.choices.length > 0) {
      view = run.choose(view.choices[0] as Choice);
    }
    return { run, view };
  }

  it("is shown locked below it, with the Teflon it needs, and cannot be chosen", () => {
    const { run, view } = offered(gated(50));

    expect(view.step).toMatchObject({
      kind: "escape",
      escapes: expect.arrayContaining([
        { id: "lose-it", label: "LOSE-IT", needs: { label: "Teflon", at: 60 } },
      ]) as unknown,
    });
    const ids = view.choices.map((c) =>
      c.type === "escape" ? c.escapeId : "",
    );
    expect(ids).toEqual(["blame-cal", "deny-it", "take-it"]);
    expect(() =>
      run.choose({ type: "escape", billId: "on-you", escapeId: "lose-it" }),
    ).toThrow(/not available/);
  });

  it("can be chosen once Teflon reaches it", () => {
    const { view } = offered(gated(60));

    expect(view.step).toMatchObject({
      kind: "escape",
      escapes: expect.arrayContaining([
        { id: "lose-it", label: "LOSE-IT", needs: undefined },
      ]) as unknown,
    });
    expect(view.choices).toContainEqual({
      type: "escape",
      billId: "on-you",
      escapeId: "lose-it",
    });
  });

  it("is never on Take it, and is one Teflon can be below and reach", () => {
    const withMin = (id: string, minTeflon: number) =>
      raw({
        escapes: escapes.map((e) => (e.id === id ? { ...e, minTeflon } : e)),
      });
    expect(() => parseContent(withMin("take-it", 60))).toThrow(ContentError);
    expect(() => parseContent(withMin("lose-it", 0))).toThrow(
      /needs "minTeflon" above 0, and at most 100/,
    );
    expect(() => parseContent(withMin("lose-it", 101))).toThrow(
      /needs "minTeflon" above 0, and at most 100/,
    );
  });

  it("gates the game's bolder Escapes, and never a whole list but Take it", () => {
    const gatedIds = everyBill(gameContent).flatMap((b) =>
      b.escapes.flatMap((e) =>
        e.kind !== "take" && e.minTeflon !== undefined ? [e.id] : [],
      ),
    );
    expect(gatedIds).toEqual(
      expect.arrayContaining([
        "invoice-blame-your-boss",
        "letters-blame-your-boss",
        "roadmap-blame-the-programme",
        "one-tool-validation",
      ]),
    );
    for (const bill of everyBill(gameContent)) {
      if (bill.escapes.length === 0) continue;
      const open = bill.escapes.filter(
        (e) => e.kind !== "take" && e.minTeflon === undefined,
      );
      expect(open.length, bill.id).toBeGreaterThan(0);
    }
  });

  it("keeps seed 1's One tool blame on the player in month 7, with burying it locked, for escape.spec.ts", () => {
    const run = startRun({ seed: 1, content: gameContent });
    let view = playToMonth(run, "7", "blame-marjorie,deliver");
    while (view.step.kind !== "escape" && view.month === 7) {
      view = run.choose(plainChoice(view));
    }

    expect(view.step).toMatchObject({
      kind: "escape",
      id: "one-tool-blamed-you",
      escapes: expect.arrayContaining([
        expect.objectContaining({
          id: "one-tool-validation",
          needs: { label: "Teflon", at: 60 },
        }),
      ]) as unknown,
    });
  });
});

describe("the data's Escapes", () => {
  it("must be offered by a consequence of the player's bad behaviour", () => {
    expect(() => parseContent(raw({ escapes: [] }))).toThrow(
      /Bill "on-you" needs Escapes/,
    );
  });

  it("must end with Take it, and every other way out must be able to fail", () => {
    const last = escapes.at(-1);
    const takeFirst = [last, ...escapes.slice(0, -1)];
    expect(() => parseContent(raw({ escapes: takeFirst }))).toThrow(
      /one Take it, as its last Escape/,
    );
    const safeBury = escapes.map((e) =>
      e.id === "lose-it" ? { ...e, fails: undefined } : e,
    );
    expect(() => parseContent(raw({ escapes: safeBury }))).toThrow(
      /can never fail/,
    );
    const noWorse = escapes.map((e) =>
      e.id === "blame-cal" ? { ...e, failed: { body: "FINE" } } : e,
    );
    expect(() => parseContent(raw({ escapes: noWorse }))).toThrow(
      /worse than taking it/,
    );
  });

  it("are past the point of escape on a big mistake", () => {
    expect(() => parseContent(raw({ mistake: "big" }))).toThrow(
      /offers Escapes, but is past them/,
    );
    expect(() =>
      parseContent(raw({ mistake: "big", escapes: [] })),
    ).not.toThrow(ContentError);
  });

  it("are offered by every hidden risk, backfiring Thread and Grand Plan blame of the game, and no big mistake", () => {
    const offers = (bill: { escapes: readonly { kind: string }[] }) =>
      bill.escapes.length >= 2 && bill.escapes.at(-1)?.kind === "take";
    for (const risk of gameContent.risks) {
      const { onPlayer } = risk;
      expect(offers(onPlayer), risk.id).toBe(onPlayer.mistake === undefined);
    }
    for (const plan of gameContent.grandPlans?.plans ?? []) {
      expect(offers(plan.failed.onPlayer), plan.id).toBe(true);
    }
    const backfires = gameContent.threads.flatMap((t) =>
      t.outcomes.filter(
        (o) =>
          o.bill.mistake === undefined &&
          o.gauges.some((g) => g.gauge === "teflon" && g.by < 0),
      ),
    );
    expect(backfires.length).toBeGreaterThan(10);
    for (const { bill } of backfires) expect(offers(bill), bill.id).toBe(true);
    for (const thread of gameContent.threads) {
      for (const { bill } of thread.outcomes) {
        if (bill.mistake !== undefined)
          expect(bill.escapes, bill.id).toEqual([]);
      }
    }
  });
});
