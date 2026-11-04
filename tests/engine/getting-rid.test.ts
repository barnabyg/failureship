import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  resumeRun,
  startRun,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { playToMonth, plainChoice } from "../../src/ui/later-month";

interface Saved {
  state: {
    heard: { fact: string; subject: string }[];
    movesLanded: string[];
  };
}

/** A new run played plainly to the start of a month, then saved, changed and resumed. */
function at(seed: number, month: number, change?: (saved: Saved) => void) {
  const run = startRun({ seed, content: gameContent });
  playToMonth(run, String(month));
  if (!change) return run;
  const saved = JSON.parse(run.save()) as Saved;
  change(saved);
  return resumeRun({ save: JSON.stringify(saved), content: gameContent });
}

/** Plays plainly on, until a view this holds of, and returns it. */
function until(run: Run, wanted: (view: PlayerView) => boolean): PlayerView {
  let view = run.view();
  while (!wanted(view)) {
    if (view.choices.length === 0) throw new Error("Never came.");
    view = run.choose(plainChoice(view));
  }
  return view;
}

/** Plays on to the end, taking this option where it is offered, and keeps every view. */
function playOn(run: Run, optionId: string): PlayerView[] {
  let view = run.view();
  const views = [view];
  while (view.choices.length > 0) {
    const named = view.choices.find(
      (c) => "optionId" in c && c.optionId === optionId,
    );
    view = run.choose(named ?? plainChoice(view));
    views.push(view);
  }
  return views;
}

const theLine = (view: PlayerView) =>
  view.step.kind === "notification" && view.step.id === "speak-up-line";
const optionsOf = (view: PlayerView) =>
  view.step.kind === "notification" || view.step.kind === "scene"
    ? view.step.options.map((o) => o.id)
    : [];
const told = (views: PlayerView[], title: string) =>
  views.find((v) => v.step.kind === "notice" && v.step.title === title);

/** The player was told, true or not, that their boss's post was abolished. */
const heardOfThePost = (saved: Saved) => {
  saved.state.heard = [{ fact: "abolished-post", subject: "boss" }];
};

// On seeds 87 and 48 the boss's post really was abolished. On 87 a Believer
// protects the boss, and on 48 a Practitioner.
describe("asking the Speak Up line whether your boss's post still exists", () => {
  it("is offered only once you have heard it of your boss", () => {
    expect(optionsOf(until(at(87, 8), theLine))).not.toContain(
      "ask-about-the-post",
    );
    expect(optionsOf(until(at(87, 8, heardOfThePost), theLine))).toContain(
      "ask-about-the-post",
    );
  });

  it("gets rid of your boss when it is true, and whoever protects them acts on it", () => {
    const run = at(87, 8, heardOfThePost);
    const views = playOn(run, "ask-about-the-post");
    const truth = readHiddenTruth(run);

    expect(told(views, "A change in the team")?.month).toBe(8);
    expect(truth.vacancies[0]).toMatchObject({ way: "fired", opened: 9 });
    expect(truth.risks.map((r) => r.id)).toContain("line-call");
  });

  it("is buried by a Practitioner who protects your boss", () => {
    const run = at(48, 8, heardOfThePost);
    const views = playOn(run, "ask-about-the-post");
    const truth = readHiddenTruth(run);

    expect(told(views, "Business as usual")?.month).toBe(8);
    expect(truth.vacancies.map((v) => v.way)).not.toContain("fired");
    expect(truth.risks.map((r) => r.id)).toContain("line-call");
  });
});

// Seed 4 has seen a rumour started about it by month 14, when the pool gives
// it the retrospective.
describe("a rumour about your boss at the retrospective", () => {
  const retro = (view: PlayerView) =>
    view.step.kind === "scene" && view.step.id === "retrospective";

  it("is open only once you have seen a rumour started", () => {
    expect(optionsOf(until(at(4, 14), retro))).toContain(
      "rumour-about-your-boss",
    );
    const unseen = at(4, 14, (saved) => {
      saved.state.movesLanded = saved.state.movesLanded.filter(
        (m) => m !== "rumour",
      );
    });
    expect(optionsOf(until(unseen, retro))).not.toContain(
      "rumour-about-your-boss",
    );
  });

  it("tries to get rid of your boss, and can be traced through whoever you told", () => {
    const run = at(4, 14);
    const views = playOn(run, "rumour-about-your-boss");
    const outcome = views.find(
      (v) =>
        v.step.kind === "notice" &&
        ["A change in the team", "Business as usual"].includes(v.step.title),
    );

    expect(outcome?.month).toBe(14);
    expect(readHiddenTruth(run).risks.map((r) => r.id)).toContain(
      "boss-rumour",
    );
  });
});
