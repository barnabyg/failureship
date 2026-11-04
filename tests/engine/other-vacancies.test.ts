import { describe, expect, it } from "vitest";
import { parseContent, startRun, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { answer } from "./grand-plan-fixture";
import {
  aboveAna,
  allOfKind,
  otherFixture,
  otherRaw,
  playWith,
} from "./other-vacancy-fixture";

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

const told = (views: PlayerView[], title: string) =>
  views.find((v) => v.step.kind === "notice" && v.step.title === title);

const bossIn = (view: PlayerView | undefined) =>
  view?.orgChart.find((e) => e.title.endsWith("YOUR-BOSS"))?.name;

describe("a boss who leaves", () => {
  const content = otherFixture();

  it("leaves their seat open, decided by whoever held influence over them", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const run = allOfKind(seed, content, "believer");
      const views = playWith(run, "burn");
      const truth = readHiddenTruth(run);

      expect(truth.vacancies, `seed ${String(seed)}`).toMatchObject([
        { holder: "ana", way: "left", opened: 3, decides: 3 },
      ]);
      expect(told(views, "SEAT-OPEN-LEFT")?.month).toBe(2);
      const above = aboveAna(seed, content);
      // With nobody above her, whoever is most influential decides.
      expect(truth.vacancies[0]?.decided?.decider).toBe(
        above ?? truth.powerMap.order[0],
      );
    }
  });

  it("is never in a place again: whoever they answered to covers until the seat is filled", () => {
    const run = allOfKind(1, content, "believer");
    const views = playWith(run, "burn");
    const inMonth = (month: number) => views.find((v) => v.month === month);

    expect(bossIn(inMonth(1))).toBe("Ana Abel");
    expect(bossIn(inMonth(2))).toBe("Dee Dunn");
    expect(bossIn(inMonth(3))).toBe("Dee Dunn");
    expect(views.flatMap((v) => v.orgChart).map((e) => e.name)).toContain(
      "Dee Dunn",
    );
    expect(
      views
        .filter((v) => v.month >= 2)
        .flatMap((v) => v.orgChart)
        .some((e) => e.name === "Ana Abel"),
    ).toBe(false);
  });

  it("takes their Grand Plan with them, unfinished", () => {
    const run = allOfKind(1, content, "believer");
    const views = playWith(run, "burn");
    const results = views.at(-1)?.step;
    if (results?.kind !== "results") throw new Error("No results.");

    expect(readHiddenTruth(run).plans[0]).toMatchObject({
      boss: "ana",
      ended: { month: 2, how: "dropped" },
    });
    expect(results.grandPlans[0]?.fate).toBe("DROPPED");
    expect(results.vacancies[0]?.text).toMatch(/^Ana Abel LEFT, SEAT WENT TO/);
  });
});

describe("getting rid of your boss", () => {
  it("fires them, opens their seat, and the one who acted on it decides it", () => {
    const content = otherFixture(1);
    for (const seed of SEEDS.slice(0, 10)) {
      const above = aboveAna(seed, content);
      if (above === undefined) continue;
      const run = startRun({ seed, content });
      const views = playWith(run, "report-boss");
      const truth = readHiddenTruth(run);

      expect(told(views, "BOSS-GONE")?.month).toBe(1);
      expect(told(views, "SEAT-OPEN-FIRED")?.month).toBe(1);
      expect(truth.vacancies).toMatchObject([
        { holder: "ana", way: "fired", opened: 2, decides: 2 },
      ]);
      expect(truth.vacancies[0]?.decided?.decider).toBe(above);
    }
  });

  it("lapses whatever the player had promised them", () => {
    const content = otherFixture(1);
    const run = startRun({ seed: 1, content });
    const views = playWith(run, "promise-and-report");

    expect(views.at(-2)?.promises).toEqual([
      expect.objectContaining({ status: "LAPSED" }),
    ]);
  });

  it("is up to whoever holds influence over the boss: at no chance, the boss stays and remembers", () => {
    const content = otherFixture(0);
    const run = startRun({ seed: 1, content });
    const before = readHiddenTruth(run).bossBelief;
    run.choose(answer("get-rid", "report-boss"));
    const after = readHiddenTruth(run).bossBelief;
    const views = playWith(run, "report-boss");
    const truth = readHiddenTruth(run);

    expect(views[0]?.step).toMatchObject({ title: "BOSS-STAYS" });
    expect(after).toBeLessThan(before);
    expect(truth.vacancies.filter((v) => v.way === "fired")).toEqual([]);
    expect(truth.memories).toContainEqual(
      expect.objectContaining({
        character: "ana",
        about: "tried-to-get-rid-of-me",
      }),
    );
  });

  it("can be traced to the player, and a big mistake while the seat is open costs it", () => {
    const content = otherFixture(1);
    const seed = SEEDS.find((s) => aboveAna(s, content) !== undefined) ?? 1;
    const run = allOfKind(seed, content, "believer");
    const views = playWith(run, "report-boss");
    const truth = readHiddenTruth(run);

    expect(told(views, "IT-WAS-YOU")?.month).toBe(2);
    expect(truth.risks).toContainEqual(
      expect.objectContaining({
        id: "traced-to-you",
        cameOut: expect.objectContaining({ onPlayer: true }) as unknown,
      }),
    );
    expect(truth.vacancies[0]?.decided?.winner).not.toBe("you");
  });

  it("is refused by a way that is not written", () => {
    const raw = otherRaw();
    const [question] = raw.notifications;
    const option = question?.options.find((o) => o.id === "report-boss");
    if (!option) throw new Error("No option.");
    Object.assign(option, { ousts: "poison" });

    expect(() => parseContent(raw)).toThrow(/unknown way "poison"/);
  });
});

describe("a Company Event that opens the seat", () => {
  it("seconds the boss upstairs, and the seat is decided by whoever holds influence over them", () => {
    const content = otherFixture(1, "movedUp");
    const run = startRun({ seed: 1, content });
    const views = playWith(run, "keep-quiet");
    const truth = readHiddenTruth(run);

    expect(told(views, "SEAT-OPEN-MOVED-UP")?.month).toBe(1);
    expect(truth.vacancies).toMatchObject([
      { holder: "ana", way: "movedUp", opened: 2, decides: 2 },
    ]);
    expect(truth.vacancies[0]?.decided?.decider).toBe(
      aboveAna(1, content) ?? "ana",
    );
    expect(views.at(-1)?.orgChart).toContainEqual(
      expect.objectContaining({ name: "Ana Abel", title: "UPSTAIRS" }),
    );
  });

  it("creates a post out of the boss's team, which its winner holds, and the boss stays", () => {
    const content = otherFixture(1, "created");
    const outcomes = SEEDS.map((seed) => {
      const run = startRun({ seed, content });
      const views = playWith(run, "keep-quiet");
      const truth = readHiddenTruth(run);
      // Whoever holds influence over the boss decides a post out of their team.
      expect(truth.vacancies[0]?.decided?.decider).toBe(
        aboveAna(seed, content) ?? "ana",
      );
      return { views, decided: truth.vacancies[0]?.decided };
    });
    const lost = outcomes.find((o) => o.decided?.winner !== "you");
    const won = outcomes.find((o) => o.decided?.winner === "you");

    expect(outcomes.every((o) => o.decided?.held.title === "NEW-POST")).toBe(
      true,
    );
    expect(told(lost?.views ?? [], "SEAT-OPEN-CREATED")?.month).toBe(1);
    const chartLost = lost?.views.at(-1)?.orgChart ?? [];
    expect(chartLost).toContainEqual(
      expect.objectContaining({ name: "Ana Abel", reportsTo: "Dee Dunn" }),
    );
    expect(chartLost).toContainEqual(
      expect.objectContaining({
        title: "NEW-POST, YOUR-BOSS",
        reportsTo: "Dee Dunn",
      }),
    );
    expect(won?.views.at(-1)?.job.id).toBe("lead-job");
  });

  it("passes by a player on another floor", () => {
    const raw = otherRaw(1, "movedUp");
    Object.assign(raw.events[0] ?? {}, { floor: "lead-job" });
    const run = startRun({ seed: 1, content: parseContent(raw) });
    const views = playWith(run, "keep-quiet");

    expect(views.some((v) => v.step.kind === "event")).toBe(false);
    expect(
      readHiddenTruth(run).vacancies.filter((v) => v.way === "movedUp"),
    ).toEqual([]);
  });

  it("passes by while a seat is already open", () => {
    const content = otherFixture(1, "movedUp");
    const run = startRun({ seed: 1, content });
    const views = playWith(run, "report-boss");

    expect(views.some((v) => v.step.kind === "event")).toBe(false);
    expect(readHiddenTruth(run).vacancies.map((v) => v.way)).toEqual(["fired"]);
  });

  it("needs seats to open one", () => {
    const raw: Record<string, unknown> = otherRaw(1, "movedUp");
    const notifications = otherRaw().notifications;
    const without = Object.fromEntries(
      Object.entries(raw).filter(
        ([key]) => !["vacancies", "rivals"].includes(key),
      ),
    );
    without.notifications = notifications.filter((n) => n.id !== "seat-talk");

    expect(() => parseContent(without)).toThrow(/opens a seat, but no seats/);
  });
});

describe("moving the player and their bosses", () => {
  it("lets a Company Event move the player, the boss and the boss's boss", () => {
    const raw = otherRaw();
    Object.assign(raw, {
      events: [
        {
          id: "moves",
          from: "The Board",
          title: "MOVES",
          body: "Everyone moves.",
          changed: "MOVED",
          schedule: { months: [1], chance: 1 },
          reshuffle: {
            reports: [
              { character: "{boss}", to: "eve" },
              { character: "you", to: "ben" },
            ],
          },
          story: { reported: "MOVES-REPORTED" },
        },
      ],
    });
    const run = startRun({ seed: 1, content: parseContent(raw) });
    const views = playWith(run, "keep-quiet");
    const after = views.find((v) => v.month === 2);

    expect(bossIn(after)).toBe("Ben Bird");
    // Ana answers to Eve, of the floor above, whom the player has not met.
    expect(after?.orgChart).toContainEqual(
      expect.objectContaining({
        name: "Ana Abel",
        title: "Boss, YOUR-BOSSS-BOSS",
        reportsTo: null,
      }),
    );
  });
});
