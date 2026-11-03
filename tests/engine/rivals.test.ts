import { describe, expect, it } from "vitest";
import {
  parseContent,
  startRun,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth, type PowerMap } from "../../src/engine/hidden-truth";
import { capitalised } from "../../src/engine/say";
import { calledAtStart, floorOwn, sceneFixtureRaw } from "./fixture";

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

/** Ana is the boss, and the boss and Ben compete for the credit. Cal never does. */
function rivalsRaw() {
  return {
    ...sceneFixtureRaw(),
    rivals: {
      competing: [
        { id: "credit", for: "FOR-CREDIT", who: ["{boss}", "ben"] },
      ] as { id: string; for: string; who: string[]; when?: unknown }[],
      most: 2,
      seatChance: 0,
      moveChance: 0.5,
      didNothing: "DID-NOTHING",
    },
  };
}

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
      const run = startRun({ seed, content });
      const cal = readHiddenTruth(run).characters.find((c) => c.id === "cal");
      expect(readHiddenTruth(run).rivals.map((r) => r.character)).not.toContain(
        "cal",
      );
      run.choose({ type: "action", actionId: "kettle" });
      while (run.view().month === 1) {
        const next = run.view().choices[0];
        if (!next) break;
        run.choose(next);
      }
      const seat = readHiddenTruth(run).rivals.find(
        (r) => r.character === "cal",
      );
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
    const burn = {
      character: "ben",
      about: "burn",
      text: "BURNED",
      tone: "bad",
    };
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
      const run = startRun({ seed, content });
      const believer =
        readHiddenTruth(run).characters.find((c) => c.id === "ben")?.kind ===
        "believer";
      run.choose({
        type: "notification",
        notificationId: "burns",
        optionId: "burn",
      });
      while (run.view().month === 1) {
        const next = run.view().choices[0];
        if (!next) break;
        run.choose(next);
      }
      if (!believer) continue;
      changed += 1;
      expect(readHiddenTruth(run).rivals).toContainEqual(
        expect.objectContaining({ character: "ben", since: 2 }),
      );
    }

    expect(changed).toBeGreaterThan(0);
  });
});

/** Plays on with the first choice each time, keeping every view. */
function playOut(run: Run): PlayerView[] {
  const views = [run.view()];
  for (;;) {
    const next = views.at(-1)?.choices[0];
    if (!next) return views;
    views.push(run.choose(next));
  }
}

function resultsOf(views: readonly PlayerView[]) {
  const step = views.at(-1)?.step;
  if (step?.kind !== "results") throw new Error(step?.kind);
  return step;
}

/** A Rival claims the credit whenever they can, and someone else does something else. */
function rivalMovesRaw() {
  const raw = rivalsRaw();
  raw.rivals.moveChance = 1;
  raw.moves = [
    {
      id: "claimed",
      by: "{rival}",
      family: "deflect",
      from: "Overheard",
      title: "MOVE-CLAIMED",
      body: "{rival} CLAIMED your work.",
      sets: ["credit-claimed"],
    },
    { id: "plain", from: "Facilities", title: "MOVE-PLAIN", body: "Plain." },
  ];
  const family = (label: string) => ({ label, note: "NOTE" });
  return {
    ...raw,
    families: {
      impress: family("IMPRESS"),
      fabricate: family("FABRICATE"),
      trade: family("TRADE"),
      "find-out": family("FIND-OUT"),
      deflect: family("DEFLECT"),
      attack: family("ATTACK"),
      deliver: family("DELIVER"),
    },
  };
}

describe("the deal", () => {
  it("can make a run with no Rival as rare as the data says", () => {
    const withChance = (seatChance: number) => {
      const raw = rivalsRaw();
      raw.rivals.seatChance = seatChance;
      const content = parseContent(raw);
      return SEEDS.filter((seed) => rivalsOf(seed, content).rivals.length === 0)
        .length;
    };

    expect(withChance(0)).toBeGreaterThan(0);
    expect(withChance(1)).toBe(0);
  });
});

describe("Rivals in content", () => {
  it("rejects competing by someone who is not there", () => {
    const raw = rivalsRaw();
    raw.rivals.competing[0]?.who.push("bne");

    expect(() => parseContent(raw)).toThrow(/names unknown "bne"/);
  });

  it("rejects {rival} in a Move that no Rival makes", () => {
    const raw = rivalMovesRaw();
    const plain = raw.moves[1];
    if (plain) plain.body = "{rival} did it.";

    expect(() => parseContent(raw)).toThrow(/says \{rival\}, but is not made/);
  });

  it("rejects a false story that nobody tells", () => {
    const raw = storyRaw(1);
    const rumour = raw.moves[0];
    if (rumour) delete rumour.by;

    expect(() => parseContent(raw)).toThrow(/needs a "by"/);
  });
});

describe("a Rival's Move", () => {
  it("lands on the player only while they have a Rival, and is made by one", () => {
    const content = parseContent(rivalMovesRaw());
    let landed = 0;
    let none = 0;

    for (const seed of SEEDS) {
      const run = startRun({ seed, content });
      const views = playOut(run);
      const { rivals } = readHiddenTruth(run);
      const moves = views.flatMap((v) =>
        v.step.kind === "move" ? [v.step] : [],
      );
      if (rivals.length === 0) {
        none += 1;
        expect(moves.map((m) => m.title)).not.toContain("MOVE-CLAIMED");
        continue;
      }
      landed += 1;
      const claimed = moves.find((m) => m.title === "MOVE-CLAIMED");
      const makers = rivals.filter((r) => r.did.length > 0);
      expect(makers).toHaveLength(1);
      const maker = makers[0]?.character ?? "";
      expect(claimed?.body).toBe(
        `${capitalised(calledAtStart(content, maker))} CLAIMED your work.`,
      );
      expect(makers[0]?.did).toEqual([{ month: 1, move: "claimed" }]);
      expect(resultsOf(views).rivals).toContainEqual(
        expect.objectContaining({
          competed: ["FOR-CREDIT"],
          did: [{ month: 1, text: "MOVE-CLAIMED", family: "DEFLECT" }],
          didNothing: null,
        }),
      );
    }

    expect(landed).toBeGreaterThan(0);
    expect(none).toBeGreaterThan(0);
  });
});

describe("the player view", () => {
  it("never says who is a Rival: only the results screen does", () => {
    const competingWith = (who: string) => {
      const raw = rivalsRaw();
      raw.rivals.competing = [{ id: "credit", for: "FOR-CREDIT", who: [who] }];
      return parseContent(raw);
    };
    const [ben, cal] = [competingWith("ben"), competingWith("cal")];
    let differ = 0;

    for (const seed of SEEDS.slice(0, 60)) {
      const one = playOut(startRun({ seed, content: ben }));
      const other = playOut(startRun({ seed, content: cal }));
      const rivals = (views: PlayerView[]) => resultsOf(views).rivals;
      if (JSON.stringify(rivals(one)) !== JSON.stringify(rivals(other))) {
        differ += 1;
      }
      const shown = (views: PlayerView[]) => JSON.stringify(views.slice(0, -1));

      expect(shown(one)).toBe(shown(other));
      expect(shown(one)).not.toContain("FOR-CREDIT");
    }

    expect(differ).toBeGreaterThan(0);
  });
});

/** Everyone within so many ties of influence of where something started. */
function within(map: PowerMap, from: string, hops: number): Set<string> {
  let reached = new Set([from]);
  for (let i = 0; i < hops; i++) {
    const next = new Set(reached);
    for (const { who, over } of map.influence) {
      if (reached.has(who)) next.add(over);
      if (reached.has(over)) next.add(who);
    }
    reached = next;
  }
  return reached;
}

/**
 * Six people, a Rival's false story in the first month, and news that goes one
 * tie a month, as far as `maxHops`, and that nobody sees through unless told to.
 */
function storyRaw(maxHops: number, foundOut = 0) {
  const raw = rivalMovesRaw();
  raw.balance.monthsPerRun = 4;
  raw.hiddenTruth.charactersWithFact = 4;
  raw.hiddenTruth.facts.push({
    id: "fact-d",
    text: "SECRET-DELTA about {name}",
  });
  raw.characters.push(
    { id: "dan", name: "Dan Dee", title: "Clerk", reportsTo: "ana" },
    { id: "eve", name: "Eve Ely", title: "Clerk", reportsTo: "ana" },
    { id: "fay", name: "Fay Fox", title: "Clerk", reportsTo: "ana" },
  );
  raw.moves = [
    {
      id: "rumour",
      by: "{rival}",
      family: "attack",
      from: "Overheard",
      title: "MOVE-RUMOUR",
      body: "Your project is in trouble, apparently.",
      story: { about: "in-trouble", text: "STORY-IN-TROUBLE" },
    },
    // Enough of these that the story is told only once.
    ...[1, 2, 3].map((n) => ({
      id: `plain-${String(n)}`,
      from: "Facilities",
      title: `MOVE-PLAIN-${String(n)}`,
      body: "Plain.",
    })),
  ];
  const sign = (id: string, warm: number, neutral: number, cold: number) => ({
    id,
    text: `{who} SIGN-${id}`,
    likelihood: { warm, neutral, cold },
  });
  return {
    ...raw,
    reputation: {
      travel: {
        hopsPerMonth: 1,
        maxHops,
        passOnChance: 1,
        shift: { good: 1, bad: -1 },
      },
      mood: { warmAt: 1, coldAt: -1 },
      signs: [sign("warm", 9, 1, 0), sign("cold", 0, 1, 9)],
      believes: {
        warm: "THINKS-WELL",
        neutral: "NO-VIEW",
        cold: "THINKS-BADLY",
      },
      how: { direct: "WAS-THERE", heardFrom: "HEARD-FROM {who}" },
      falseStories: {
        foundOut: { believer: foundOut, incompetent: 0, practitioner: 0 },
        started: "STARTED-IT",
        found: "FOUND-OUT-IN {month}",
      },
    },
  };
}

describe("a false story", () => {
  it("reaches only those it can travel to on the Power Map, and moves what they believe", () => {
    const content = parseContent(storyRaw(1));
    let told = 0;
    let missed = 0;

    for (const seed of SEEDS) {
      const run = startRun({ seed, content });
      playOut(run);
      const { memories, powerMap, news, beliefs } = readHiddenTruth(run);
      const story = news.findIndex((n) => n.text === "STORY-IN-TROUBLE");
      if (story < 0) continue;
      const teller = news[story]?.startedBy ?? "";
      const heard = memories.filter((m) => m.news === story);
      const reachable = within(powerMap, teller, 1);

      // Passed on at every chance, it reaches all of them and nobody else.
      expect(new Set(heard.map((m) => m.character))).toEqual(reachable);
      for (const memory of heard) {
        if (memory.character === teller) continue;
        told += 1;
        expect(memory.via).toBe(teller);
        // Bosses' beliefs carry on moving with the month, so look at everyone else.
        if (memory.character !== "ana") {
          expect(beliefs[memory.character]).toBe(-1);
        }
      }
      // The one who made it up knows better.
      expect(beliefs[teller] ?? 0).toBe(0);
      missed += content.characters.length - reachable.size;
    }

    expect(told).toBeGreaterThan(0);
    expect(missed).toBeGreaterThan(0);
  });

  it("travels further where the data lets it, along the same ties", () => {
    const content = parseContent(storyRaw(2));
    for (const seed of SEEDS.slice(0, 60)) {
      const run = startRun({ seed, content });
      playOut(run);
      const { memories, powerMap, news } = readHiddenTruth(run);
      const story = news.findIndex((n) => n.text === "STORY-IN-TROUBLE");
      if (story < 0) continue;
      const reachable = within(powerMap, news[story]?.startedBy ?? "", 2);
      for (const memory of memories.filter((m) => m.news === story)) {
        expect(reachable.has(memory.character)).toBe(true);
      }
    }
  });

  it("can be found out, which undoes what it did to that person", () => {
    const content = parseContent(storyRaw(1, 1));
    let found = 0;

    for (const seed of SEEDS) {
      const run = startRun({ seed, content });
      const views = playOut(run);
      const { memories, news, beliefs, characters } = readHiddenTruth(run);
      const story = news.findIndex((n) => n.text === "STORY-IN-TROUBLE");
      for (const memory of memories.filter((m) => m.news === story)) {
        const kind = characters.find((c) => c.id === memory.character)?.kind;
        const believer = kind === "believer";
        const teller = memory.via === null;
        expect(memory.foundOut !== null).toBe(believer && !teller);
        if (!believer || teller || memory.character === "ana") continue;
        found += 1;
        expect(beliefs[memory.character]).toBe(0);
        const reached = resultsOf(views).beliefs.find(
          (b) =>
            b.name ===
            content.characters.find((c) => c.id === memory.character)?.name,
        )?.reached;
        expect(reached).toContainEqual(
          expect.objectContaining({
            text: "STORY-IN-TROUBLE",
            how: expect.stringContaining("FOUND-OUT-IN 3") as unknown,
          }),
        );
      }
    }

    expect(found).toBeGreaterThan(0);
  });
});

describe("using a Move a Rival used on you", () => {
  function usingRaw() {
    const raw = rivalMovesRaw();
    raw.scenes[0]?.options.push({
      id: "claim-it-back",
      label: "CLAIM-IT-BACK",
      requires: { sawMove: "claimed" },
      results: [{ body: "CLAIMED-BACK" }],
    });
    return raw;
  }

  function meetingOptions(view: PlayerView) {
    return view.step.kind === "scene" ? view.step.options.map((o) => o.id) : [];
  }

  it("is on offer once the player has seen it done to them, and not before", () => {
    const content = parseContent(usingRaw());
    let offered = 0;

    for (const seed of SEEDS) {
      const run = startRun({ seed, content });
      const views = playOut(run);
      const meetings = views.filter((v) => v.step.kind === "scene");
      const landed = views.some(
        (v) => v.step.kind === "move" && v.step.title === "MOVE-CLAIMED",
      );
      expect(meetingOptions(meetings[0] as PlayerView)).not.toContain(
        "claim-it-back",
      );
      expect(
        meetingOptions(meetings[1] as PlayerView).includes("claim-it-back"),
      ).toBe(landed);
      if (landed) offered += 1;
    }

    expect(offered).toBeGreaterThan(0);
  });

  it("can be gated on a Move that a Rival made, which the player has seen", () => {
    expect(() => parseContent(usingRaw())).not.toThrow();
  });

  it("cannot be gated on what the Rival's Move set, which says there is a Rival", () => {
    const raw = usingRaw();
    const option = raw.scenes[0]?.options.at(-1);
    if (option) option.requires = { did: "credit-claimed" };

    expect(() => parseContent(raw)).toThrow(/gated on the hidden truth/);
  });

  it("must name a Move there is", () => {
    const raw = usingRaw();
    const option = raw.scenes[0]?.options.at(-1);
    if (option) option.requires = { sawMove: "clamied" };

    expect(() => parseContent(raw)).toThrow(/unknown Move "clamied"/);
  });
});
