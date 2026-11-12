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
  it("waits in the inbox as the month opens, with the floor open at once", () => {
    const run = startRun({ seed: 1, content: fixture() });
    const first = run.view();

    expect(first.step).toMatchObject({ kind: "notification", id: "invite" });
    expect(first.waiting).toBe(false);
    expect(first.inbox).toMatchObject({
      items: [{ kind: "notification", id: "invite", short: false }],
      toAnswer: 1,
    });
    expect(first.choices).toContainEqual({
      type: "action",
      actionId: "kettle",
    });

    const after = run.choose({ type: "action", actionId: "kettle" });

    expect(after.step).toMatchObject({ kind: "notification", id: "invite" });
    expect(after.result).toMatchObject({ kind: "happened" });
    expect(after.actions.remaining).toBe(2);
  });

  it("keeps an action for the inbox, so the month cannot close with it unanswered", () => {
    const run = startRun({ seed: 1, content: fixture() });
    run.choose({ type: "action", actionId: "kettle" });
    const kept = run.choose({ type: "action", actionId: "desk" });

    expect(kept.actions.remaining).toBe(1);
    expect(kept.choices.every((c) => c.type === "notification")).toBe(true);
    expect(
      kept.hotspots.filter((h) => h.state === "available").map((h) => h.id),
    ).toEqual([]);
    expect(kept.hint).toBe(
      "Answer your inbox to close the month: 1 to answer.",
    );
    expect(kept.step.kind).toBe("notification");

    const closed = chooseReport(run);

    expect(closed.step.kind).toBe("story");
    expect(closed.inbox).toEqual({ items: [], toAnswer: 0 });
  });

  it("can be answered in any order", () => {
    const raw = fixtureRaw();
    raw.notifications.push({
      id: "second",
      from: "Facilities",
      subject: "Fire drill",
      body: "Please evacuate in an orderly fashion.",
      options: [{ id: "noted", label: "Noted" }],
    });
    const run = startRun({ seed: 1, content: parseContent(raw) });

    const view = run.choose({
      type: "notification",
      notificationId: "second",
      optionId: "noted",
    });

    expect(view.step).toMatchObject({ kind: "notification", id: "invite" });
    expect(
      view.inbox.items.map((i) => i.kind === "notification" && i.id),
    ).toEqual(["invite"]);
  });

  it("is shown short once it has been answered in an earlier month", () => {
    const run = startRun({ seed: 1, content: fixture() });
    let view = chooseReport(run);
    while (view.month === 1) {
      view = run.choose(view.choices[0] as Parameters<Run["choose"]>[0]);
    }

    expect(view.step).toMatchObject({
      kind: "notification",
      id: "invite",
      short: true,
    });
    // Its full text is still there, a click away.
    expect(view.inbox.items[0]).toMatchObject({
      short: true,
      body: expect.any(String) as unknown,
    });
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

    expect(view.result).toMatchObject({
      then: { kind: "dialog", title: "At the pub" },
    });
    expect(view.buzzwords.map((b) => b.id)).toEqual(["fixture-word"]);
    expect(view.actions.remaining).toBe(2);
  });

  it("the dialog leaves actions to spend", () => {
    const run = startRun({ seed: 1, content: fixture() });

    const view = choosePub(run);

    expect(view.step.kind).toBe("actions");
    expect(view.buzzwords).toHaveLength(1);
  });

  it("finishing the report costs an action and teaches nothing", () => {
    const run = startRun({ seed: 1, content: fixture() });

    const view = chooseReport(run);

    expect(view.result).toMatchObject({ then: { kind: "notice" } });
    expect(view.buzzwords).toEqual([]);
    expect(view.actions.remaining).toBe(2);
    expect(view.step.kind).toBe("actions");
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

    const view = chooseReport(run);

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
