import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { action, emptyMonthRaw } from "./fixture";

const notice = { title: "Done", body: "Done." };

function redFixtureRaw() {
  const raw = emptyMonthRaw();
  raw.project.start = { real: "bad", reported: "fair" };
  raw.project.flagged = { at: "bad", scene: "review", cost: "standard" };
  raw.scenes.push({
    id: "review",
    title: "REVIEW",
    location: "Floor 1",
    narration: ["It is red."],
    cast: ["ana", "ben", "cal"],
    signs: [],
    options: [
      {
        id: "deflect",
        label: "Deflect",
        results: [{ body: "Amber now.", project: { reported: "fair" } }],
      },
      { id: "honest", label: "Tell them", results: [{ body: "Still red." }] },
    ],
  });
  return {
    ...raw,
    actions: [action("kettle"), action("desk"), action("copier")],
    notifications: [
      {
        id: "report",
        from: "Boss",
        subject: "Report",
        body: "File it.",
        options: [
          {
            id: "honest",
            label: "File it honestly",
            project: { reported: "real" },
            result: notice,
          },
          { id: "quiet", label: "Say nothing", result: notice },
        ],
      },
    ],
  };
}

const report = (optionId: string): Choice => ({
  type: "notification",
  notificationId: "report",
  optionId,
});

function fixtureRun() {
  return startRun({ seed: 1, content: parseContent(redFixtureRaw()) });
}

function sceneIdOf(view: PlayerView) {
  return view.step.kind === "scene" ? view.step.id : null;
}

/** Plays a whole run by a seeded rule, watching for flags and the review. */
function watchRun(seed: number) {
  const run = startRun({ seed, content: gameContent });
  let view = run.view();
  let flags = 0;
  let reviews = 0;
  let walk = seed;
  let reported = view.project.reported;
  while (view.step.kind !== "results") {
    walk = (walk * 31 + 7) % 1009;
    const choice = view.choices[walk % view.choices.length];
    if (!choice) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(choice);
    if (view.project.reported === "Red" && reported !== "Red") flags += 1;
    reported = view.project.reported;
    if (sceneIdOf(view) === "red-project" && choice.type !== "scene") {
      reviews += 1;
    }
  }
  return { flags, reviews };
}

/** Lies in every report and turns down everything else, so it never goes red. */
function neverRedRun(run: Run) {
  const scenes: (string | null)[] = [];
  const offered: string[][] = [];
  let view = run.view();
  while (view.step.kind !== "results") {
    scenes.push(sceneIdOf(view));
    offered.push(
      view.hotspots.filter((h) => h.place === "meeting-room").map((h) => h.id),
    );
    let next = view.choices.at(-1);
    if (view.step.kind === "notification") {
      const { id, options } = view.step;
      const free = options.find((o) => o.costLabel === "Costs nothing");
      const optionId = options.some((o) => o.id === "lie")
        ? "lie"
        : options.some((o) => o.id === "chase")
          ? "chase"
          : (free?.id ?? "");
      next = { type: "notification", notificationId: id, optionId };
    }
    if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(next);
  }
  return { scenes, offered };
}

describe("a Project flagged red", () => {
  it("opens the review as soon as it is flagged, in whichever month", () => {
    const run = fixtureRun();

    const view = run.choose(report("honest"));
    expect(view.project.reported).toBe("STATUS-BAD");

    expect(sceneIdOf(run.choose({ type: "continue" }))).toBe("review");
  });

  it("opens it in a later month, if that is when it goes red", () => {
    const run = fixtureRun();
    run.choose(report("quiet"));
    let view = run.choose({ type: "continue" });
    while (view.month === 1) {
      const next = view.choices[0];
      if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
      view = run.choose(next);
    }
    expect(view.step).toMatchObject({ kind: "notification", id: "report" });

    run.choose(report("honest"));

    expect(sceneIdOf(run.choose({ type: "continue" }))).toBe("review");
    expect(run.view().month).toBe(2);
  });

  it("costs what the data says, and nothing past what is left", () => {
    const run = fixtureRun();
    run.choose(report("honest"));

    expect(run.choose({ type: "continue" }).actions.spent).toBe(1);
  });

  it("lets explaining change the reported status, but never the real one", () => {
    const run = fixtureRun();
    run.choose(report("honest"));
    run.choose({ type: "continue" });

    const { project } = run.choose({
      type: "scene",
      sceneId: "review",
      optionId: "deflect",
    });

    expect(project.reported).toBe("STATUS-FAIR");
    expect(project.real).toBe("STATUS-BAD");
  });

  it("does not open it twice for one flag, even if the status stays red", () => {
    const run = fixtureRun();
    run.choose(report("honest"));
    run.choose({ type: "continue" });
    run.choose({ type: "scene", sceneId: "review", optionId: "honest" });

    expect(run.choose({ type: "continue" }).step.kind).toBe("actions");
  });

  it("opens it again if the status goes red a second time", () => {
    const run = fixtureRun();
    run.choose(report("honest"));
    run.choose({ type: "continue" });
    run.choose({ type: "scene", sceneId: "review", optionId: "deflect" });
    let view = run.choose({ type: "continue" });
    while (view.month === 1) {
      const next = view.choices[0];
      if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
      view = run.choose(next);
    }

    run.choose(report("honest"));

    expect(sceneIdOf(run.choose({ type: "continue" }))).toBe("review");
  });
});

describe("the Project Status Review in the game", () => {
  const review = gameContent.scenes.find((s) => s.id === "red-project");
  const seeds = Array.from({ length: 80 }, (_, i) => i + 1);

  it("opens if and only if the Project has been flagged red", () => {
    const runs = seeds.map(watchRun);

    expect(runs.some((r) => r.flags > 0)).toBe(true);
    expect(runs.some((r) => r.flags === 0)).toBe(true);
    for (const { flags, reviews } of runs) expect(reviews).toBe(flags);
  });

  it("belongs to no month, and no action opens it", () => {
    expect(review?.months).toBeUndefined();
    expect(gameContent.actions.map((a) => a.scene)).not.toContain(
      "red-project",
    );
  });

  it("does not appear in a run that never goes red, and the month has a meeting", () => {
    const { scenes, offered } = neverRedRun(
      startRun({ seed: 4, content: gameContent }),
    );

    expect(scenes).not.toContain("red-project");
    expect(offered.flat()).toContain("meeting-quarterly");
  });

  it("offers a Deflect option and an honest one, and can change the report", () => {
    const options = review?.options ?? [];
    const results = (id: string) =>
      options.find((o) => o.id === id)?.results ?? [];

    expect(results("make-it-amber")[0]?.project?.reported).toBe("amber");
    expect(results("tell-the-truth")[0]?.project).toBeUndefined();
    expect(results("tell-the-truth")[0]?.approach).toBe("truth");
  });

  it("varies with the boss's kind and with who holds influence", () => {
    const options = review?.options ?? [];
    const approaches = options.flatMap((o) =>
      o.results.flatMap((r) => r.approach ?? []),
    );
    const readsHolder = options.some((o) =>
      o.results.some((r) => r.when && "holderIs" in r.when),
    );

    expect(new Set(approaches).size).toBeGreaterThanOrEqual(3);
    expect(readsHolder).toBe(true);
  });
});

describe("the flag in content", () => {
  it("refuses a flag on an unknown status or Scene", () => {
    const badStatus = redFixtureRaw();
    badStatus.project.flagged = {
      at: "nope",
      scene: "review",
      cost: "standard",
    };
    const badScene = redFixtureRaw();
    badScene.project.flagged = { at: "bad", scene: "nope", cost: "standard" };

    expect(() => parseContent(badStatus)).toThrow(/unknown status "nope"/);
    expect(() => parseContent(badScene)).toThrow(/unknown Scene "nope"/);
  });

  it("refuses a review that is also set in a month or opened by an action", () => {
    const inMonth = redFixtureRaw();
    const scene = inMonth.scenes[0];
    if (scene) scene.months = [1];
    const byAction = redFixtureRaw();

    expect(() => parseContent(inMonth)).toThrow(/not by month/);
    expect(() =>
      parseContent({
        ...byAction,
        actions: [
          ...byAction.actions,
          { ...action("plant"), result: undefined, scene: "review" },
        ],
      }),
    ).toThrow(/not by action/);
  });
});
