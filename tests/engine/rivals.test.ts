import { describe, expect, it } from "vitest";
import { gameContent, panelText } from "../../src/content";
import {
  parseContent,
  startRun,
  type Content,
  type PlayerView,
} from "../../src/engine";
import { castDealtFirst } from "../../src/engine/deal";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice } from "../../src/ui/later-month";
import { floorOwn } from "./fixture";
import { everyTold } from "./landed";
import {
  competitorMovesRaw,
  playOut,
  resultsOf,
  rivalsRaw,
  SEEDS,
} from "./rival-fixture";

function rivalsOf(seed: number, content: Content) {
  const truth = readHiddenTruth(startRun({ seed, content }));
  const practitioners = truth.characters
    .filter((c) => c.kind === "practitioner")
    .map((c) => c.id);
  return {
    practitioners,
    rivals: truth.rivals.map((r) => r.character).sort(),
  };
}

/** Plays the first month with the first choice each time, after one chosen first. */
function playMonth(content: Content, seed: number, first: object) {
  const run = startRun({ seed, content });
  run.choose(first as Parameters<typeof run.choose>[0]);
  while (run.view().month === 1) {
    const next = run.view().choices[0];
    if (!next) break;
    run.choose(next);
  }
  return run;
}

describe("who is a Rival", () => {
  it("is every Practitioner competing with the player, the boss included", () => {
    const content = parseContent(rivalsRaw());
    const seen = new Set<string>();

    for (const seed of SEEDS) {
      const { practitioners, rivals } = rivalsOf(seed, content);
      expect(rivals).toEqual(
        ["ana", "ben"].filter((id) => practitioners.includes(id)),
      );
      for (const rival of rivals) seen.add(rival);
    }

    expect(seen).toEqual(new Set(["ana", "ben"]));
  });

  it("is no more than the most influential few of them", () => {
    const raw = rivalsRaw();
    raw.rivals.most = 1;
    const content = parseContent(raw);

    for (const seed of SEEDS) {
      const truth = readHiddenTruth(startRun({ seed, content }));
      const competing = truth.powerMap.order.filter((id) =>
        truth.characters.some(
          (c) => c.id === id && c.kind === "practitioner" && id !== "cal",
        ),
      );
      expect(truth.rivals.map((r) => r.character)).toEqual(
        competing.slice(0, 1),
      );
    }
  });

  it("can be anyone at all, for something open to everyone", () => {
    const raw = rivalsRaw();
    raw.rivals.most = 3;
    raw.rivals.competing = [{ id: "any", for: "FOR-ANY", who: ["{everyone}"] }];
    const content = parseContent(raw);

    for (const seed of SEEDS) {
      const { practitioners, rivals } = rivalsOf(seed, content);
      expect(rivals).toEqual([...practitioners].sort());
    }
  });

  it("follows the Org Chart: whoever comes to share your boss can compete", () => {
    const raw = rivalsRaw();
    raw.rivals.competing = [
      { id: "favour", for: "FOR-FAVOUR", who: ["{peers}"] },
    ];
    raw.characters = raw.characters.map((c) =>
      c.id === "cal" ? { ...c, reportsTo: "ben" } : c,
    );
    const content = parseContent({
      ...raw,
      events: [
        {
          id: "reorganised",
          from: "The Board",
          title: "REORGANISED",
          body: "Cal moves.",
          story: { reported: "R", happened: "H" },
          schedule: { months: [1], chance: 1 },
          reshuffle: { reports: [{ character: "cal", to: "ana" }] },
          changed: "CAL-MOVED",
        },
      ],
    });
    let moved = 0;

    for (const seed of SEEDS) {
      const run = startRun({ seed, content });
      const before = readHiddenTruth(run).rivals.map((r) => r.character);
      expect(before).not.toContain("cal");
      while (run.view().month === 1) {
        const next = run.view().choices[0];
        if (!next) break;
        run.choose(next);
      }
      const truth = readHiddenTruth(run);
      const cal = truth.characters.find((c) => c.id === "cal");
      const record = truth.rivals.find((r) => r.character === "cal");
      if (cal?.kind !== "practitioner") continue;
      moved += 1;
      expect(record?.since).toBe(2);
    }

    expect(moved).toBeGreaterThan(0);
  });

  it("can be competing for something only while it is open, such as a seat", () => {
    const raw = rivalsRaw();
    raw.rivals.most = 3;
    raw.rivals.competing.push({
      id: "seat",
      for: "FOR-SEAT",
      who: ["cal"],
      when: { did: "seat-opened" },
    });
    raw.actions = raw.actions.map((a) =>
      a.id === "kettle" ? { ...a, sets: ["seat-opened"] } : a,
    );
    const content = parseContent(raw);
    let rivalled = 0;

    for (const seed of SEEDS) {
      const start = readHiddenTruth(startRun({ seed, content }));
      expect(start.rivals.map((r) => r.character)).not.toContain("cal");
      const run = playMonth(content, seed, {
        type: "action",
        actionId: "kettle",
      });
      const seat = readHiddenTruth(run).rivals.find(
        (r) => r.character === "cal",
      );
      const cal = start.characters.find((c) => c.id === "cal");
      if (cal?.kind === "practitioner") {
        rivalled += 1;
        expect(seat).toMatchObject({ since: 2, for: ["seat"] });
      } else {
        expect(seat).toBeUndefined();
      }
    }

    expect(rivalled).toBeGreaterThan(0);
  });

  it("can be a Believer who has changed into a Practitioner", () => {
    const raw = rivalsRaw();
    const burn = { character: "ben", about: "burn", text: "B", tone: "bad" };
    raw.notifications = [
      {
        id: "burns",
        from: "Someone",
        subject: "BURNS",
        body: "Burn Ben.",
        floor: "fixture-job",
        months: [1],
        options: [{ id: "burn", label: "Burn Ben", remembers: [burn, burn] }],
      },
      ...floorOwn(),
    ] as typeof raw.notifications;
    const content = parseContent({
      ...raw,
      changing: {
        threshold: 2,
        burns: [
          {
            about: "burn",
            weight: 1,
            why: "WHY",
            leans: { practitioner: 1, whistleblower: 0, left: 0 },
          },
        ],
        became: {
          practitioner: "BECAME-PRACTITIONER",
          whistleblower: "BECAME-WHISTLEBLOWER",
          left: "BECAME-LEFT",
        },
        whistleblower: {
          share: 0.5,
          signs: [{ id: "file", text: "{who} KEEPS-A-FILE", weight: 1 }],
          motive: "{who} WENT-UPSTAIRS",
          reports: [
            { bill: { id: "reported", as: "notice", title: "R", body: "R." } },
          ],
        },
        leaving: {},
      },
    });
    let changed = 0;

    for (const seed of SEEDS) {
      const believer =
        readHiddenTruth(startRun({ seed, content })).characters.find(
          (c) => c.id === "ben",
        )?.kind === "believer";
      const run = playMonth(content, seed, {
        type: "notification",
        notificationId: "burns",
        optionId: "burn",
      });
      if (!believer) continue;
      changed += 1;
      expect(readHiddenTruth(run).rivals).toContainEqual(
        expect.objectContaining({ character: "ben", since: 2 }),
      );
    }

    expect(changed).toBeGreaterThan(0);
  });
});

describe("the deal", () => {
  const MANY = Array.from({ length: 1000 }, (_, i) => i + 1);

  /** How often no Rival is dealt, and how often each Character is a Practitioner. */
  function rates(dealAgain: number) {
    const raw = rivalsRaw();
    raw.rivals.dealAgain = dealAgain;
    const content = parseContent(raw);
    const practitioner: Record<string, number> = {};
    let none = 0;
    for (const seed of MANY) {
      const { practitioners, rivals } = rivalsOf(seed, content);
      if (rivals.length === 0) none += 1;
      for (const id of practitioners) {
        practitioner[id] = (practitioner[id] ?? 0) + 1 / MANY.length;
      }
    }
    return { none: none / MANY.length, practitioner };
  }

  it("deals again sometimes when nobody competing is a Practitioner, so no Rival is rarer", () => {
    expect(rates(1).none).toBeLessThan(rates(0).none / 2);
    expect(rates(0).none).toBeGreaterThan(0);
  });

  it("leaves someone who never competes about as likely to be a Practitioner", () => {
    const [plain, again] = [rates(0), rates(1)];

    expect(
      Math.abs((again.practitioner.cal ?? 0) - (plain.practitioner.cal ?? 0)),
    ).toBeLessThan(0.08);
  });
});

describe("Rivals in content", () => {
  it("rejects competing by someone who is not there", () => {
    const raw = rivalsRaw();
    raw.rivals.competing[0]?.who.push("bne");

    expect(() => parseContent(raw)).toThrow(/names unknown "bne"/);
  });

  it("takes groups read from the Org Chart", () => {
    const raw = rivalsRaw();
    raw.rivals.competing[0]?.who.push("{peers}", "{everyone}");

    expect(() => parseContent(raw)).not.toThrow();
  });

  it("rejects odds of who makes a Move that say nothing of their kind", () => {
    const raw = rivalsRaw();
    raw.rivals.makers = { believer: 2, incompetent: 2, practitioner: 2 };

    expect(() => parseContent(raw)).toThrow(/no evidence of a kind/);
  });
});

describe("the player view", () => {
  it("never says who is a Rival, even when competitors' Moves name who made them", () => {
    // With room for one Rival or two, the same Practitioners compete and the same
    // Moves land, but who is a Rival differs. Only the results screen shows it.
    const withMost = (most: number) => {
      const raw = competitorMovesRaw();
      raw.rivals.most = most;
      return parseContent(raw);
    };
    const [one, two] = [withMost(1), withMost(2)];
    let differ = 0;

    for (const seed of SEEDS.slice(0, 80)) {
      const first = playOut(startRun({ seed, content: one }));
      const second = playOut(startRun({ seed, content: two }));
      const rivals = (views: PlayerView[]) => resultsOf(views).rivals;
      if (JSON.stringify(rivals(first)) !== JSON.stringify(rivals(second))) {
        differ += 1;
      }
      const shown = (views: PlayerView[]) => JSON.stringify(views.slice(0, -1));

      expect(shown(first)).toBe(shown(second));
      expect(shown(first)).toMatch(/CLAIMED your work/);
      expect(shown(first)).not.toContain("FOR-CREDIT");
    }

    expect(differ).toBeGreaterThan(0);
  });
});

describe("the game's Rivals", () => {
  const MANY = Array.from({ length: 1000 }, (_, i) => i + 1);

  /** Plays as the browser tests' plain player does, keeping every view. */
  function playPlainly(seed: number) {
    const run = startRun({ seed, content: gameContent });
    const views = [run.view()];
    let view = views[0] as PlayerView;
    while (view.choices.length > 0) {
      view = run.choose(plainChoice(view));
      views.push(view);
    }
    return { run, views };
  }

  it("deals a run with no Rival rarely, never more than two, and no role's kind fixed", () => {
    const counts = [0, 0, 0];
    const practitioner: Record<string, number> = {};
    for (const seed of MANY) {
      const { rivals, characters } = readHiddenTruth(
        startRun({ seed, content: gameContent }),
      );
      counts[rivals.length] = (counts[rivals.length] ?? 0) + 1;
      for (const c of characters.filter((x) => x.kind === "practitioner")) {
        practitioner[c.id] = (practitioner[c.id] ?? 0) + 1 / MANY.length;
      }
    }
    const [none = 0, one = 0, two = 0] = counts;

    expect(none / MANY.length).toBeLessThan(0.1);
    expect(none).toBeGreaterThan(0);
    expect(one).toBeGreaterThan(0);
    expect(two).toBeGreaterThan(0);
    expect(none + one + two).toBe(MANY.length);
    // A later floor's cast is dealt by its own draws, with no Rival to ensure.
    const shares = castDealtFirst(gameContent).map(
      (id) => practitioner[id] ?? 0,
    );
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThan(0.12);
  });

  it("makes competitors' Moves from the families the player has", () => {
    const families = (items: readonly { family?: string | undefined }[]) =>
      new Set(items.flatMap((i) => i.family ?? []));
    const players = families([
      ...gameContent.actions,
      ...gameContent.notifications.flatMap((n) => n.options),
      ...gameContent.scenes.flatMap((s) => s.options),
    ]);
    const competitors = gameContent.moves.filter(
      (m) => m.by === "{competitor}",
    );

    // Taking the Plan's credit and a long lunch are for an open seat.
    expect(families(competitors)).toEqual(
      new Set(["deflect", "attack", "impress", "trade"]),
    );
    for (const family of families(competitors)) {
      expect(players).toContain(family);
    }
    expect(competitors.some((m) => m.falseStory !== undefined)).toBe(true);
  });

  // Whether a maker is sometimes a Rival is in tests/balance/rivals.test.ts.

  // tests/e2e/rival.spec.ts plays these: a competitor's false story lands in month 1
  // of seed 39, and in month 8 the player tells one too, to the Office
  // Co-ordinator. On seed 22 nobody tells one, so the player cannot either.
  it("keeps the seeds the browser test uses", () => {
    const { run, views } = playPlainly(39);
    const offered = (all: readonly PlayerView[]) =>
      all.some(
        (v) =>
          v.step.kind === "scene" &&
          v.step.options.some((o) => o.id === "start-a-rumour"),
      );
    const rumour = everyTold(views).find(
      ({ told }) => told.kind === "move" && told.title.includes("in trouble"),
    );
    const { news, memories } = readHiddenTruth(run);
    const story = news.findIndex((n) => n.startedBy !== undefined);

    expect(rumour?.month).toBe(1);
    expect(offered(views)).toBe(true);
    expect(
      memories.filter((m) => m.news === story && m.via !== null).length,
    ).toBeGreaterThan(0);
    expect(offered(playPlainly(22).views)).toBe(false);
  });

  it("never says who is a Rival before the results screen", () => {
    const written = gameContent.rivals;
    const words = [
      ...(written?.competing.map((c) => c.for) ?? []),
      written?.didNothing ?? "",
      panelText.resultsRivalsHeading,
      panelText.resultsNoRivals,
    ];
    for (const seed of SEEDS.slice(0, 30)) {
      const { views } = playPlainly(seed);
      for (const view of views.slice(0, -1)) {
        const seen = JSON.stringify(view);
        expect(seen).not.toMatch(/\brivals?\b/i);
        for (const word of words) expect(seen).not.toContain(word);
      }
    }
  });
});
