import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  gameContent,
  gaugeTitles,
  parseGaugeTitles,
  parsePanelText,
  panelText,
} from "../../src/content";
import { startRun, type Choice, type Run } from "../../src/engine";
import { chasedIdOf } from "../../src/engine/content";
import { castDealtFirst } from "../../src/engine/deal";
import { bossesAtStart, meantBy } from "../../src/engine/places";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { plainChoice, playToMonth } from "../../src/ui/later-month";
import { behavioursIn } from "./scene-view";
import { landedIn, notesIn } from "./landed";
import { everyPath } from "./month-paths";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Where a browser test is once it has started at a later month and filed the report. */
function reachActionsOfMonth(run: Run, month: string) {
  let view = playToMonth(run, month);
  while (view.step.kind !== "actions") view = run.choose(plainChoice(view));
}

const isFindOut = (choice: Choice) =>
  choice.type === "action" &&
  gameContent.actions.some(
    (a) => a.id === choice.actionId && a.findOut !== undefined,
  );

/** Who holds influence among the people in the meeting, on this deal. */
function holderInMeeting(seed: number) {
  const run = startRun({ seed, content: gameContent });
  const meeting = gameContent.scenes.find((s) => s.id === "meeting");
  const bosses = bossesAtStart(gameContent);
  const cast = meeting?.cast.map((c) => meantBy(bosses, c));
  return readHiddenTruth(run).powerMap.order.find((id) => cast?.includes(id));
}

/** Turns down the pub and files the report, to reach month 1's floor. */
function fileTheReport(run: Run) {
  run.choose({
    type: "notification",
    notificationId: "pub-invite",
    optionId: "decline",
  });
  run.choose({
    type: "notification",
    notificationId: "monthly-report",
    optionId: "report",
  });
}

describe("the real month", () => {
  it("refuses panel text with a word missing", () => {
    const missingTitle = { ...panelText, title: undefined };

    expect(() => parsePanelText(missingTitle)).toThrow(/title/);
  });

  it("says what each Gauge is, and refuses a Gauge with nothing said", () => {
    expect(gaugeTitles.teflon).toMatch(/blame/);
    expect(gaugeTitles.fawning).toMatch(/sucking up/);

    const onlyTeflon = { teflon: gaugeTitles.teflon };
    expect(() => parseGaugeTitles(onlyTeflon, gameContent.gauges)).toThrow(
      /fawning/,
    );
  });

  it("has no placeholder text in any data file", () => {
    const folder = path.join(import.meta.dirname, "../../content");
    for (const file of readdirSync(folder)) {
      const written = readFileSync(path.join(folder, file), "utf8");
      expect(written, file).not.toMatch(/placeholder|lorem|todo|tbc/i);
    }
  });

  // Every path through month 1 is walked in
  // tests/balance/real-month-paths.test.ts.

  it("leaves the Power Map to be read from the signs alone", () => {
    const told = JSON.stringify([
      gameContent.officialStory,
      gameContent.moves,
      gameContent.scenes.map((s) => [s.narration, s.options]),
    ]);

    expect(told).not.toMatch(/\{(holder|ignored|bystander)\}/);
  });

  it("never shows a dealt kind or Hidden Fact before the end of a run", () => {
    for (const seed of SEEDS) {
      const run = startRun({ seed, content: gameContent });
      const { characters } = readHiddenTruth(run);
      let view = run.view();
      let walk = seed;
      while (view.step.kind !== "results") {
        const seen = JSON.stringify(view);
        expect(seen).not.toMatch(/Believer|Incompetent|Practitioner/i);
        expect(seen).not.toContain("powerMap");
        for (const { fact } of characters) {
          if (fact) expect(seen).not.toContain(fact.text);
        }
        walk = (walk * 31 + 7) % 1009;
        const open = view.choices.filter((c) => !isFindOut(c));
        const choice = open[walk % open.length];
        if (!choice) throw new Error(`Stuck at ${view.step.kind}.`);
        view = run.choose(choice);
      }
    }
  });

  it("reveals every Character at the end of a run", () => {
    const run = startRun({ seed: 2, content: gameContent });
    let view = run.view();
    const jobs = new Set<string>();
    for (;;) {
      const choice = view.choices.at(-1);
      if (!choice) break;
      view = run.choose(choice);
      jobs.add(view.job.id);
    }

    expect(view.step).toMatchObject({ kind: "results" });
    if (view.step.kind !== "results") throw new Error(view.step.kind);
    // This run is promoted to Floor 2, so all eight are met: four of Floor 1's
    // six have a Hidden Fact, and on this deal one of Floor 2's two does. It
    // need not end there: what it does on the way can send it back down.
    expect(jobs).toContain("team-lead");
    expect(view.step.characters).toHaveLength(8);
    expect(view.step.characters.filter((c) => c.fact !== null)).toHaveLength(5);
    expect(JSON.stringify(view)).not.toMatch(/\{\w+\}/);
  });

  it("tells many different official stories", () => {
    const stories = new Set(
      everyPath(1).map((views) => JSON.stringify(views.at(-1)?.step)),
    );

    expect(stories.size).toBeGreaterThan(20);
  });

  it("lets the player watch every Character, whose kind the results reveal", () => {
    // A place in a cast is whoever is in it, on Floor 1 or a floor above.
    const { boss, head } = bossesAtStart(gameContent);
    const places: Record<string, string[]> = {
      "{boss}": [boss, head ?? "", "programme"],
      "{head}": [head ?? "", "programme", "transformation"],
    };
    const present = new Set(
      gameContent.scenes.flatMap((s) => s.cast.flatMap((c) => places[c] ?? c)),
    );

    expect(present).toEqual(new Set(gameContent.characters.map((c) => c.id)));
  });

  it("never has the meeting's holder below anyone on the true Power Map", () => {
    const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
    for (const seed of seeds) {
      const run = startRun({ seed, content: gameContent });
      const { influence } = readHiddenTruth(run).powerMap;

      expect(influence.map((i) => i.over)).not.toContain(holderInMeeting(seed));
    }
  });

  it("lets anyone in the meeting hold influence, depending on the deal", () => {
    const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
    const holders = new Set(seeds.map(holderInMeeting));

    expect(holders).toEqual(
      new Set(["head", "boss", "analyst", "admin", "projects", "associate"]),
    );
  });

  it("gives every Character of Floor 1 a place on one Org Chart, and nobody from upstairs", () => {
    const { orgChart } = startRun({ seed: 1, content: gameContent }).view();

    expect(orgChart.map((e) => e.name).sort()).toEqual(
      castDealtFirst(gameContent)
        .map((id) => gameContent.characters.find((c) => c.id === id)?.name)
        .sort(),
    );
    expect(orgChart.filter((e) => e.reportsTo === null)).toHaveLength(1);
  });

  // The browser tests rely on these two deals.
  it("keeps the deals that the Hidden Fact browser tests use", () => {
    const nature = (seed: number, character: string) => {
      const dealt = readHiddenTruth(
        startRun({ seed, content: gameContent }),
      ).characters.find((c) => c.id === character);
      return gameContent.hiddenTruth.facts.find((f) => f.id === dealt?.fact?.id)
        ?.nature;
    };
    const run = startRun({ seed: 57, content: gameContent });
    reachActionsOfMonth(run, "8");
    run.choose({ type: "action", actionId: "inside-info" });
    const told = run.choose({
      type: "find-out",
      sourceId: "admin",
      subjectId: "boss",
    });

    expect(nature(106, "analyst")).toBe("dangerous");
    expect(JSON.stringify(told.result)).toContain("abolished");
    // What the Office Co-ordinator says is true, so the results screen shows it.
    const boss = readHiddenTruth(run).characters.find((c) => c.id === "boss");
    expect(boss?.fact?.id).toBe("abolished-post");
  });

  // The late-input browser test relies on this.
  it("keeps the report's input late in month 2 on seed 1", () => {
    const run = startRun({ seed: 1, content: gameContent });
    fileTheReport(run);
    let view = run.view();
    while (view.month === 1) {
      const next = view.choices.at(-1);
      if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
      view = run.choose(next);
    }
    run.choose({
      type: "notification",
      notificationId: "training",
      optionId: "skip-training",
    });
    // Month 1's meeting was missed, so its action comes before the report.
    const given = run.choose({
      type: "notification",
      notificationId: "fewer-meetings",
      optionId: "push-back",
    }).step;
    if (given.kind !== "notification") throw new Error(given.kind);
    const after = run.choose({
      type: "notification",
      notificationId: given.id,
      optionId: "push-back",
    });

    expect(after.step).toMatchObject({ id: "report-input-late" });
  });

  // The Demand browser test relies on these.
  it.each([
    [4, "chased"],
    [283, "forgotten"],
  ])("keeps what follows a stalled Demand on seed %i", (seed, fate) => {
    // As the browser test plays it: plainly, but skipping the training and
    // stalling the Demand in month 2.
    const run = startRun({ seed, content: gameContent });
    const wanted: Record<string, string> = {
      training: "skip-training",
      "fewer-meetings": "stall",
    };
    let view = run.view();
    while (view.month < 3) {
      const { step } = view;
      const optionId =
        step.kind === "notification" ? wanted[step.id] : undefined;
      const next: Choice =
        step.kind === "notification" && optionId !== undefined
          ? { type: "notification", notificationId: step.id, optionId }
          : plainChoice(view);
      view = run.choose(next);
    }

    // Chased, it is the first e-mail in the inbox. Forgotten, a note says so.
    const chased =
      view.step.kind === "notification" &&
      view.step.id === chasedIdOf("fewer-meetings");
    const forgotten = notesIn(view).some((n) => n.title === "Meetings");
    expect({ chased, forgotten }).toEqual({
      chased: fate === "chased",
      forgotten: fate === "forgotten",
    });
  });

  // docs/playtest.md contrasts these two seeds.
  it("keeps the two contrasting deals the playtest describes", () => {
    const of = (seed: number) => {
      const { characters } = readHiddenTruth(
        startRun({ seed, content: gameContent }),
      );
      return Object.fromEntries(
        characters.map((c) => {
          const fact = gameContent.hiddenTruth.facts.find(
            (f) => f.id === c.fact?.id,
          );
          return [c.id, { kind: c.kind, nature: fact?.nature ?? "none" }];
        }),
      );
    };

    const meeting = (seed: number) => {
      const run = startRun({ seed, content: gameContent });
      fileTheReport(run);
      const view = run.choose({ type: "action", actionId: "meeting" });
      if (view.step.kind !== "scene") throw new Error(view.step.kind);
      return view.step;
    };
    const firstSign = (seed: number) => meeting(seed).signs[0]?.text;
    const meetingSigns = (seed: number) =>
      behavioursIn(meeting(seed), gameContent);

    expect(holderInMeeting(283)).toBe("boss");
    expect(holderInMeeting(106)).toBe("analyst");
    expect(firstSign(283)).toMatch(/^Your boss talks over/);
    expect(firstSign(106)).toMatch(/^The Senior Analyst talks over/);
    expect(of(283).projects?.nature).toBe("dangerous");
    expect(of(106).projects?.nature).toBe("useful");
    expect(of(283).analyst?.nature).toBe("useful");
    expect(of(106).analyst?.nature).toBe("dangerous");
    expect(meetingSigns(58)).toContainEqual({
      who: "your boss",
      text: "Overruns, then schedules another meeting.",
    });
    expect(meetingSigns(57)).toContainEqual({
      who: "the Project Co-ordinator",
      text: "Closes, then reopens, late tasks.",
    });
    expect(of(283).boss?.kind).toBe("incompetent");
    expect(of(106).boss?.kind).toBe("believer");
  });

  // tests/e2e/risk.spec.ts relies on this.
  it("keeps a Demand faked in month 2 coming back in month 4 on seed 13", () => {
    const run = startRun({ seed: 13, content: gameContent });
    let view = playToMonth(run, "4", "do-training,fake");
    const moves: string[] = [];
    while (view.month === 4) {
      for (const l of landedIn(view)) if (l.kind === "move") moves.push(l.body);
      view = run.choose(plainChoice(view));
    }

    expect(moves.join()).toContain("correction to the minutes");
  });

  // tests/e2e/fired.spec.ts relies on this: blaming and then cutting the Project
  // Co-ordinator are both big mistakes on this seed.
  it("keeps seed 9's Project Co-ordinator with a dangerous Hidden Fact", () => {
    const dealt = readHiddenTruth(
      startRun({ seed: 9, content: gameContent }),
    ).characters.find((c) => c.id === "projects");
    const fact = gameContent.hiddenTruth.facts.find(
      (f) => f.id === dealt?.fact?.id,
    );

    expect(fact?.nature).toBe("dangerous");
  });

  // docs/playtest.md relies on these.
  it.each([
    [106, "believer"],
    [283, "incompetent"],
    [37, "practitioner"],
  ])("keeps seed %i dealing a boss who is a %s", (seed, kind) => {
    const { characters } = readHiddenTruth(
      startRun({ seed, content: gameContent }),
    );

    expect(characters.find((c) => c.id === "boss")?.kind).toBe(kind);
  });

  it.each([
    [4, 3, 5, "actions"],
    [13, 3, 1, "actions"],
    [37, -3, -6, "notice"],
  ])(
    "keeps what going over the boss's head does on seed %i",
    (seed, head, boss, then) => {
      const run = startRun({ seed, content: gameContent });
      fileTheReport(run);
      const before = readHiddenTruth(run);
      const view = run.choose({ type: "action", actionId: "over-head" });
      const after = readHiddenTruth(run);

      expect(after.headBelief - before.headBelief).toBe(head);
      expect(after.bossBelief - before.bossBelief).toBe(boss);
      expect(view.result).toMatchObject({ kind: "happened" });
      expect(view.step.kind).toBe(then);
    },
  );

  // The over-head browser test relies on this.
  it("keeps a trip over the boss's head paying off in month 8 on seed 58", () => {
    const run = startRun({ seed: 58, content: gameContent });
    reachActionsOfMonth(run, "8");

    const told = run.choose({ type: "action", actionId: "over-head" });

    expect(JSON.stringify(told.result)).toContain("told to listen to you");
  });

  // Each of these holds influence in the meeting on that seed.
  it.each([
    [8, "boss"],
    [106, "analyst"],
    [12, "admin"],
    [9, "projects"],
    [6, "head"],
    [5, "associate"],
  ])("keeps the seed %i documented for %s", (seed, holder) => {
    expect(holderInMeeting(seed)).toBe(holder);
  });
});
