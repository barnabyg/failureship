import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
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
import { plainChoice } from "../../src/ui/later-month";
import { sceneFixtureRaw, floorOwn } from "./fixture";

const SEEDS = Array.from({ length: 200 }, (_, i) => i);
const WIDE = Array.from({ length: 2000 }, (_, i) => i);
type Way = "practitioner" | "whistleblower" | "left";

function raw(ways: Way[] = ["practitioner", "whistleblower", "left"]) {
  const base = sceneFixtureRaw();
  const leans = {
    practitioner: Number(ways.includes("practitioner")),
    whistleblower: Number(ways.includes("whistleblower")),
    left: Number(ways.includes("left")),
  };
  const burn = (character: string) => ({
    character,
    about: "burn",
    text: `BURNED-${character}`,
    tone: "bad",
  });
  return {
    ...base,
    balance: { ...base.balance, monthsPerRun: 4 },
    behaviours: [
      {
        id: "trusting",
        text: "{who} TRUSTS",
        likelihood: { believer: 1, incompetent: 1, practitioner: 0 },
      },
      {
        id: "knowing",
        text: "{who} KNOWS",
        likelihood: { believer: 0, incompetent: 1, practitioner: 1 },
      },
    ],
    notifications: [
      {
        id: "burns",
        from: "Someone",
        subject: "BURNS",
        body: "Burn them.",
        floor: "fixture-job",
        months: [1],
        options: [
          {
            id: "burn",
            label: "Burn everyone",
            sets: ["burned"],
            remembers: ["ana", "ben", "cal"].flatMap((c) => [burn(c), burn(c)]),
          },
          { id: "spare", label: "Spare them" },
        ],
      },
      ...floorOwn(),
    ],
    risks: [
      {
        id: "buried",
        addedBy: "burned",
        after: { min: 9, max: 9 },
        note: "RISK-NOTE",
        route: {
          character: "cal",
          chance: { believer: 0, incompetent: 0, practitioner: 0 },
          motive: "RISK-MOTIVE",
        },
        traced: { did: "burned" },
        onPlayer: {
          id: "risk-bill",
          as: "notice",
          title: "RISK-OUT",
          body: "It came out.",
        },
        landedOnYou: "LANDED",
        landedElsewhere: "ELSEWHERE",
        neverCameOut: "NEVER",
      },
    ],
    changing: {
      threshold: 2,
      burns: [{ about: "burn", weight: 1, why: "WHY-BURNED", leans }],
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
        ] as { when?: Record<string, unknown>; bill: Record<string, string> }[],
      },
      leaving: {
        ben: {
          cover: "the temp",
          notice: { title: "BEN-LEFT", body: "Ben Bird has gone." },
        },
        cal: {
          cover: "the interim",
          notice: { title: "CAL-LEFT", body: "Cal Cope has gone." },
        },
      },
    },
  };
}

const burnAll: Choice = {
  type: "notification",
  notificationId: "burns",
  optionId: "burn",
};

/** Plays on with the first choice each time, keeping every view. */
function playOut(run: Run): PlayerView[] {
  const views = [run.view()];
  for (;;) {
    const next = views.at(-1)?.choices[0];
    if (!next) return views;
    views.push(run.choose(next));
  }
}

const kindsAtStart = (seed: number, content: Content) =>
  readHiddenTruth(startRun({ seed, content })).characters;

describe("a Believer burned repeatedly", () => {
  it("changes, and nobody of another kind ever does, across many seeds", () => {
    const content = parseContent(raw());
    const ways = new Set<string>();
    for (const seed of SEEDS) {
      const before = kindsAtStart(seed, content);
      const run = startRun({ seed, content });
      run.choose(burnAll);
      playOut(run);
      const { changes } = readHiddenTruth(run);
      for (const dealt of before) {
        const change = changes.find((c) => c.character === dealt.id);
        // The boss cannot leave, so a Believer boss has only the other two ways.
        expect(change !== undefined, `${String(seed)} ${dealt.id}`).toBe(
          dealt.kind === "believer",
        );
        if (change) ways.add(change.to);
      }
    }

    expect([...ways].sort()).toEqual(["left", "practitioner", "whistleblower"]);
  });

  it("never leaves when that would leave the player with no boss's boss, though written to be able to", () => {
    const content = parseContent(raw(["left"]));
    const seed = SEEDS.find((s) =>
      kindsAtStart(s, content).every(
        (c) => c.id === "ana" || c.kind === "believer",
      ),
    );
    const run = startRun({ seed: seed ?? 0, content });
    run.choose(burnAll);
    // Ben, who is in `leaving`, becomes the player's boss, as a seat's winner
    // does. Ana, above him, answers to nobody, so without him the player would
    // have no boss's boss.
    const saved = JSON.parse(run.save()) as {
      state: { reportsTo: Record<string, string> };
    };
    saved.state.reportsTo.you = "ben";
    const moved = resumeRun({ save: JSON.stringify(saved), content });
    playOut(moved);
    const { changes } = readHiddenTruth(moved);

    expect(changes.find((c) => c.character === "ben")).toBeUndefined();
    expect(changes.find((c) => c.character === "cal")?.to).toBe("left");
  });

  it("does not change if never burned enough", () => {
    const content = parseContent(raw());
    for (const seed of SEEDS.slice(0, 40)) {
      const run = startRun({ seed, content });
      run.choose({ ...burnAll, optionId: "spare" });
      playOut(run);

      expect(readHiddenTruth(run).changes).toEqual([]);
    }
  });

  it("shows signs that follow their new kind", () => {
    const content = parseContent(raw(["practitioner"]));
    const seed = SEEDS.find(
      (s) =>
        kindsAtStart(s, content).find((c) => c.id === "ben")?.kind ===
        "believer",
    );
    const run = startRun({ seed: seed ?? 0, content });
    const first = run.view();
    run.choose(burnAll);
    const views = playOut(run);
    const shown = (view: PlayerView) =>
      view.step.kind === "scene"
        ? view.step.behaviours.find((b) => b.who === "Ben Bird")?.text
        : undefined;
    const later = views
      .filter((v) => v.month > 1)
      .flatMap((v) => shown(v) ?? []);

    expect(shown(first) ?? "Ben Bird TRUSTS").toBe("Ben Bird TRUSTS");
    expect(later.length).toBeGreaterThan(0);
    for (const text of later) expect(text).toBe("Ben Bird KNOWS");
  });

  it("as a whistleblower, mostly shows their own signs", () => {
    const content = parseContent(raw(["whistleblower"]));
    let own = 0;
    let shown = 0;
    for (const seed of SEEDS) {
      const ben = kindsAtStart(seed, content).find((c) => c.id === "ben");
      if (ben?.kind !== "believer") continue;
      const run = startRun({ seed, content });
      run.choose(burnAll);
      for (const view of playOut(run).filter((v) => v.month > 2)) {
        if (view.step.kind !== "scene") continue;
        const text = view.step.behaviours.find(
          (b) => b.who === "Ben Bird",
        )?.text;
        shown += 1;
        if (text?.includes("KEEPS-A-FILE")) own += 1;
      }
    }

    expect(own / shown).toBeGreaterThan(0.45);
    expect(own / shown).toBeLessThan(0.75);
  });

  it("as a whistleblower, reports what they know ahead of a hidden risk", () => {
    const written = raw(["whistleblower"]);
    written.changing.whistleblower.reports.unshift({
      when: { did: "burned" },
      bill: {
        id: "known",
        as: "notice",
        title: "KNOWN-REPORTED",
        body: "They reported what they knew.",
      },
    });
    const content = parseContent(written);
    const seed = SEEDS.find(
      (s) =>
        kindsAtStart(s, content).find((c) => c.id === "ben")?.kind ===
        "believer",
    );
    const run = startRun({ seed: seed ?? 0, content });
    run.choose(burnAll);
    const views = playOut(run);

    expect(
      views.some((v) => JSON.stringify(v.step).includes("KNOWN-REPORTED")),
    ).toBe(true);
    expect(readHiddenTruth(run).risks[0]?.cameOut).toBeNull();
  });

  it("as a whistleblower, brings a hidden risk out", () => {
    const content = parseContent(raw(["whistleblower"]));
    const seed = SEEDS.find(
      (s) =>
        kindsAtStart(s, content).find((c) => c.id === "ben")?.kind ===
        "believer",
    );
    const run = startRun({ seed: seed ?? 0, content });
    run.choose(burnAll);
    const views = playOut(run);

    const [risk] = readHiddenTruth(run).risks;
    expect(risk?.cameOut?.through).toBeDefined();
    expect(views.some((v) => JSON.stringify(v.step).includes("RISK-OUT"))).toBe(
      true,
    );
    const end = views.at(-1)?.step;
    if (end?.kind !== "results") throw new Error("No results.");
    expect(end.risks[0]?.motive).toMatch(/WENT-UPSTAIRS/);
  });

  it("is never shown changing during play, only on the results screen", () => {
    const content = parseContent(raw());
    for (const seed of SEEDS.slice(0, 40)) {
      const run = startRun({ seed, content });
      run.choose(burnAll);
      const views = playOut(run);
      const end = views.pop()?.step;

      for (const view of views) {
        expect(JSON.stringify(view)).not.toMatch(/BECAME|WHY-BURNED|KIND-/);
      }
      if (end?.kind !== "results") throw new Error("No results.");
      expect(end.changed.length).toBe(readHiddenTruth(run).changes.length);
      for (const row of end.changed) {
        expect(row.from).toBe("KIND-BELIEVER");
        expect(row.why).toEqual(["WHY-BURNED"]);
      }
    }
  });

  it("can be written for the player's boss, who may then leave", () => {
    const written = raw();
    const leaving: Record<string, unknown> = written.changing.leaving;
    leaving.ana = {
      cover: "the acting boss",
      notice: { title: "ANA-LEFT", body: "Gone." },
    };

    expect(() => parseContent(written)).not.toThrow();
  });

  it("refuses a whistleblower report whose condition names an unknown Character", () => {
    const broken = raw();
    broken.changing.whistleblower.reports.unshift({
      when: { youOwe: "nobody" },
      bill: { id: "owed", as: "notice", title: "OWED", body: "Owed." },
    });

    expect(() => parseContent(broken)).toThrow(/unknown Character "nobody"/);
  });
});

/** The real game, with one Character burned in month 1 so that they leave. */
function leavingContent(...who: string[]): Content {
  const content = structuredClone(gameContent);
  if (!content.changing) throw new Error("No changing.");
  content.changing.threshold = 1;
  content.changing.burns = [
    {
      about: "test-burn",
      weight: 1,
      why: "Burned by a test.",
      leans: { practitioner: 0, whistleblower: 0, left: 1 },
    },
  ];
  content.notifications.unshift({
    id: "test-burn",
    floor: "junior-employee",
    months: [1],
    from: "A test",
    subject: "A test",
    body: "A test.",
    options: [
      {
        ...structuredClone(content.notifications[0]?.options[1]),
        id: "test-burn",
        label: "Burn them",
        cost: undefined,
        dialog: undefined,
        result: undefined,
        remembers: who.map((character) => ({
          character,
          about: "test-burn",
          text: "Burned.",
          tone: "bad" as const,
        })),
      } as Content["notifications"][number]["options"][number],
    ],
  });
  return parseContent(content);
}

/** Whether a view says, anywhere it should not, the name of someone who has gone. */
function namesSomeoneGone(view: PlayerView, gone: readonly string[]): boolean {
  if (view.step.kind === "results") return false;
  const step = JSON.stringify(view.step);
  const hotspots = JSON.stringify(view.hotspots);
  return gone.some((id) => {
    const c = gameContent.characters.find((x) => x.id === id);
    const said = [c?.name ?? id, c?.called ?? id];
    const notice =
      view.step.kind === "notice" && view.step.title.includes(c?.name ?? id);
    return !notice && said.some((s) => `${step} ${hotspots}`.includes(s));
  });
}

describe("a run in which someone leaves", { timeout: 120_000 }, () => {
  const leavers = Object.keys(gameContent.changing?.leaving ?? {});

  it("can lose anyone but the boss's boss", () => {
    expect(leavers.sort()).toEqual([
      "admin",
      "analyst",
      "associate",
      "boss",
      "projects",
    ]);
  });

  // Five Believers at once are too rare to find, so all at once is the boss's team.
  const team = leavers.filter((id) => id !== "boss");
  for (const who of [...leavers.map((id) => [id]), team]) {
    it(`completes, Scenes, report and Find Out included, when ${who.join(" and ")} leave`, () => {
      const content = leavingContent(...who);
      // Four Believers at once are rare, so this looks further than the rest.
      const seeds = WIDE.filter((seed) =>
        who.every(
          (id) =>
            kindsAtStart(seed, content).find((c) => c.id === id)?.kind ===
            "believer",
        ),
      ).slice(0, 4);
      expect(seeds.length).toBeGreaterThan(0);
      for (const seed of seeds) {
        for (const style of ["plain", "walk"] as const) {
          const run = startRun({ seed, content });
          let view = run.view();
          let walk = seed;
          const seen: PlayerView[] = [];
          while (view.choices.length > 0) {
            walk = (walk * 31 + 7) % 1009;
            const next =
              style === "plain"
                ? plainChoice(view)
                : view.choices[walk % view.choices.length];
            if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
            view = run.choose(next);
            seen.push(view);
            expect(view.hint).not.toBe("");
          }

          expect(view.step.kind).toBe("results");
          if (view.step.kind !== "results") continue;
          expect(view.step.changed.map((c) => c.to)).toEqual(
            who.map(() => "Left the company"),
          );
          const afterLeaving = seen.filter((v) => v.month > 1);
          expect(afterLeaving.some((v) => v.step.kind === "scene")).toBe(true);
          for (const shown of afterLeaving) {
            expect(
              namesSomeoneGone(shown, who),
              JSON.stringify(shown.step),
            ).toBe(false);
          }
        }
      }
    });
  }
});

describe("the real Believers", () => {
  // tests/e2e/changes.spec.ts plays this: blamed in month 2 and let down over the
  // laptops, the Senior Analyst changes before the end of the run.
  it("keeps the deal that the browser test uses", () => {
    const run = startRun({ seed: CHANGE_SEED, content: gameContent });
    const truth = readHiddenTruth(run);

    expect(truth.characters.find((c) => c.id === "analyst")?.kind).toBe(
      "believer",
    );
    const view = playBurningTheAnalyst(run);
    if (view.step.kind !== "results") throw new Error("No results.");
    expect(view.step.changed.map((c) => c.title)).toContain("Senior Analyst");
  });
});

const CHANGE_SEED = 24;

// The playtest's scenario: the same choices change the Senior Analyst three ways.
it("keeps the playtest's seeds, on which the Senior Analyst changes each way", () => {
  const became = (seed: number) => {
    const view = playBurningTheAnalyst(
      startRun({ seed, content: gameContent }),
    );
    if (view.step.kind !== "results") throw new Error("No results.");
    return view.step.changed.map((c) => [c.month, c.to]);
  };

  expect(became(24)).toEqual([[6, gameContent.changing?.became.whistleblower]]);
  expect(became(107)).toEqual([[6, gameContent.changing?.became.left]]);
  expect(became(4)).toEqual([[5, gameContent.changing?.became.practitioner]]);
});

/** Plays plainly, but blames the Senior Analyst, and lets them down over laptops. */
function playBurningTheAnalyst(run: Run): PlayerView {
  let view = run.view();
  const wanted: Record<string, string> = {
    "lessons-learned": "blame-priya",
    "laptops-request": "promise-laptops-analyst",
    "laptops-for-the-analyst-due": "next-quarter",
  };
  while (view.choices.length > 0) {
    const { step } = view;
    const id = "id" in step ? step.id : "";
    const optionId = wanted[id];
    const choice: Choice | undefined =
      optionId === undefined
        ? undefined
        : step.kind === "scene"
          ? { type: "scene", sceneId: id, optionId }
          : step.kind === "notification"
            ? { type: "notification", notificationId: id, optionId }
            : undefined;
    const legal =
      choice &&
      view.choices.some((c) => JSON.stringify(c) === JSON.stringify(choice));
    view = run.choose(legal ? choice : plainChoice(view));
  }
  return view;
}
