import { describe, expect, it } from "vitest";
import {
  parseContent,
  startRun,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { action, emptyMonthRaw, room } from "./fixture";

/** Takes the first choice offered until the month's official story. */
function toStory(run: Run): PlayerView {
  let view = run.view();
  while (view.step.kind !== "story") {
    const choice = view.choices[0];
    if (!choice) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(choice);
  }
  return view;
}

/** Two floors, with the player starting on the upper one. */
function upstairsRaw() {
  const raw = emptyMonthRaw();
  raw.floors.push({
    job: "manager",
    title: "JOB-MANAGER",
    rooms: [room("plant", 0), room("lift", 1)],
  });
  raw.you.job = "manager";
  raw.officialStory.title = "{job} Monthly Summary";
  return raw;
}

describe("the floor of the player's job", () => {
  it("is where a run starts the player, with its job title", () => {
    const run = startRun({ seed: 1, content: parseContent(upstairsRaw()) });

    expect(run.view().job).toEqual({ id: "manager", title: "JOB-MANAGER" });
  });

  it("offers only what is done in its own rooms", () => {
    const run = startRun({ seed: 1, content: parseContent(upstairsRaw()) });

    expect(run.view().hotspots.map((h) => h.id)).toEqual(["plant"]);
  });

  it("heads the official story with the job title from the run", () => {
    const run = startRun({ seed: 1, content: parseContent(upstairsRaw()) });
    const view = toStory(run);

    expect(view.step.kind === "story" && view.step.title).toBe(
      "JOB-MANAGER Monthly Summary",
    );
  });

  it("refuses a run that starts the player on a floor that does not exist", () => {
    const raw = upstairsRaw();
    raw.you.job = "nowhere";

    expect(() => parseContent(raw)).toThrow(
      'The player starts at unknown job "nowhere".',
    );
  });

  it("refuses two floors for the same job", () => {
    const raw = upstairsRaw();
    raw.floors.push({
      job: "fixture-job",
      title: "JOB-AGAIN",
      rooms: [room("plant", 0)],
    });

    expect(() => parseContent(raw)).toThrow(
      'Job "fixture-job" has more than one floor.',
    );
  });

  it("refuses an action at a place on no floor", () => {
    const raw = upstairsRaw();
    raw.actions.push({ ...action("roof") });

    expect(() => parseContent(raw)).toThrow(
      'Action "roof" is at unknown place "roof".',
    );
  });
});
