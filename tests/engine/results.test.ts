import { describe, expect, it } from "vitest";
import { parseContent, startRun } from "../../src/engine";
import {
  emptyMonthRaw,
  findOutFixtureRaw,
  fixture,
  fixtureRaw,
} from "./fixture";

/*
 * What the player's own choices lead to is kept beside whatever comes next,
 * until they choose again, so that reading it costs no click of its own.
 */

describe("the result of a place on the floor", () => {
  it("is kept beside the floor, which can still be used", () => {
    const run = startRun({ seed: 1, content: parseContent(emptyMonthRaw()) });

    const view = run.choose({ type: "action", actionId: "kettle" });

    expect(view.step.kind).toBe("actions");
    expect(view.result).toEqual({
      kind: "happened",
      title: "At kettle",
      body: "You spent time at kettle.",
      spent: "Go to kettle",
    });
    expect(view.choices).toContainEqual({ type: "action", actionId: "desk" });
  });

  it("goes as soon as the player goes to the next place", () => {
    const run = startRun({ seed: 1, content: parseContent(emptyMonthRaw()) });
    run.choose({ type: "action", actionId: "kettle" });

    const view = run.choose({ type: "action", actionId: "desk" });

    expect(view.result).toMatchObject({ title: "At desk" });
  });

  it("stays beside whatever lands once the actions are spent, until it is passed", () => {
    const run = startRun({ seed: 1, content: parseContent(emptyMonthRaw()) });
    run.choose({ type: "action", actionId: "kettle" });
    run.choose({ type: "action", actionId: "desk" });

    const last = run.choose({ type: "action", actionId: "plant" });

    expect(last.step.kind).toBe("story");
    expect(last.result).toMatchObject({ title: "At plant" });
    expect(run.choose({ type: "continue" }).result).toBeNull();
  });

  it("keeps a claim heard at Find Out, saying who said it", () => {
    const run = startRun({
      seed: 1,
      content: parseContent(findOutFixtureRaw()),
    });
    run.choose({ type: "action", actionId: "copier" });

    const view = run.choose({
      type: "find-out",
      sourceId: "ben",
      subjectId: "cal",
    });

    expect(view.step.kind).toBe("actions");
    expect(view.result).toMatchObject({
      kind: "claim",
      title: expect.stringContaining("says") as string,
      spent: "Go to copier",
    });
  });
});

describe("the result of answering a Notification", () => {
  it("is kept with the e-mail and the answer chosen", () => {
    const run = startRun({ seed: 1, content: fixture() });

    const view = run.choose({
      type: "notification",
      notificationId: "invite",
      optionId: "report",
    });

    expect(view.step.kind).toBe("actions");
    expect(view.result).toMatchObject({
      kind: "answer",
      from: "Your boss",
      subject: "Report or pub",
      answer: "Finish the report",
      then: {
        kind: "notice",
        title: "Report filed",
        body: "It has been filed.",
      },
    });
  });

  it("keeps a dialog, and the Buzzword it taught", () => {
    const run = startRun({ seed: 1, content: fixture() });

    const view = run.choose({
      type: "notification",
      notificationId: "invite",
      optionId: "pub",
    });

    expect(view.result).toMatchObject({
      kind: "answer",
      then: {
        kind: "dialog",
        title: "At the pub",
        learned: [expect.objectContaining({ id: "fixture-word" })],
      },
    });
  });

  it("says how many more Notifications are waiting", () => {
    const raw = fixtureRaw();
    const [invite] = raw.notifications;
    if (!invite) throw new Error("No invite.");
    const free = {
      id: "free",
      label: "Finish the report",
      result: { title: "Report filed", body: "It has been filed." },
    };
    raw.notifications.unshift(
      { ...invite, id: "first", options: [free] },
      { ...invite, id: "second", options: [free] },
    );
    const run = startRun({ seed: 1, content: parseContent(raw) });

    expect(run.view().step).toMatchObject({ id: "first", waiting: 2 });
    const next = run.choose({
      type: "notification",
      notificationId: "first",
      optionId: "free",
    });

    expect(next.step).toMatchObject({ id: "second", waiting: 1 });
    expect(next.result).toMatchObject({
      kind: "answer",
      answer: "Finish the report",
    });
  });
});
