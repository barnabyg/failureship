import { describe, expect, it } from "vitest";
import { parseContent, startRun, type Run } from "../../src/engine";
import { fixture, fixtureRaw } from "./fixture";

function choosePub(run: Run) {
  return run.choose({
    type: "notification",
    notificationId: "invite",
    optionId: "pub",
  });
}

function chooseReport(run: Run) {
  return run.choose({
    type: "notification",
    notificationId: "invite",
    optionId: "report",
  });
}

describe("the report-or-pub Notification", () => {
  it("opens the month before any action can be spent", () => {
    const run = startRun({ seed: 1, content: fixture() });
    const { step, choices } = run.view();

    expect(step).toMatchObject({ kind: "notification", id: "invite" });
    expect(choices.every((c) => c.type === "notification")).toBe(true);
    expect(() => run.choose({ type: "action", actionId: "kettle" })).toThrow(
      /not available/i,
    );
  });

  it("shows each choice's cost before it is made", () => {
    const { step } = startRun({ seed: 1, content: fixture() }).view();
    if (step.kind !== "notification") throw new Error(step.kind);

    expect(step.options).toEqual([
      expect.objectContaining({ id: "report", costLabel: "Costs 1 action" }),
      expect.objectContaining({ id: "pub", costLabel: "Costs 1 action" }),
    ]);
  });

  it("going to the pub opens a dialog and teaches a Buzzword", () => {
    const run = startRun({ seed: 1, content: fixture() });

    const view = choosePub(run);

    expect(view.step).toMatchObject({ kind: "dialog", title: "At the pub" });
    expect(view.buzzwords.map((b) => b.id)).toEqual(["fixture-word"]);
    expect(view.actions.remaining).toBe(2);
  });

  it("the dialog leaves actions to spend once it is closed", () => {
    const run = startRun({ seed: 1, content: fixture() });
    choosePub(run);

    const view = run.choose({ type: "continue" });

    expect(view.step.kind).toBe("actions");
    expect(view.buzzwords).toHaveLength(1);
  });

  it("finishing the report costs an action and teaches nothing", () => {
    const run = startRun({ seed: 1, content: fixture() });

    const view = chooseReport(run);

    expect(view.step.kind).toBe("notice");
    expect(view.buzzwords).toEqual([]);
    expect(view.actions.remaining).toBe(2);
    expect(run.choose({ type: "continue" }).step.kind).toBe("actions");
  });

  it("takes each choice's cost from balance data", () => {
    const raw = fixtureRaw();
    raw.balance.actionCosts.report = 2;
    const run = startRun({ seed: 1, content: parseContent(raw) });

    expect(chooseReport(run).actions.remaining).toBe(1);
  });

  it("delivers a Notification that exists only in data", () => {
    const raw = fixtureRaw();
    raw.notifications.push({
      id: "second",
      from: "Facilities",
      subject: "Fire drill",
      body: "Please evacuate in an orderly fashion.",
      options: [
        {
          id: "noted",
          label: "Noted",
          result: { title: "Noted", body: "It has been noted." },
        },
      ],
    });
    const run = startRun({ seed: 1, content: parseContent(raw) });
    chooseReport(run);

    const view = run.choose({ type: "continue" });

    expect(view.step).toMatchObject({ kind: "notification", id: "second" });
    expect(view.actions.remaining).toBe(2);
  });

  it("rejects a choice that cannot be afforded", () => {
    const raw = fixtureRaw();
    raw.balance.actionCosts.report = 4;
    const run = startRun({ seed: 1, content: parseContent(raw) });
    const { step } = run.view();
    if (step.kind !== "notification") throw new Error(step.kind);

    expect(step.options[0]?.affordable).toBe(false);
    expect(() => chooseReport(run)).toThrow(/not available/i);
  });

  it("rejects data that points at something that does not exist", () => {
    const raw = fixtureRaw();
    const option = raw.notifications[0]?.options[1];
    if (!option) throw new Error("The fixture has no pub option.");
    option.dialog = "no-such-dialog";

    expect(() => parseContent(raw)).toThrow(/no-such-dialog/);
  });
});
