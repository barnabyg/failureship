import { describe, expect, it } from "vitest";
import { parseContent, startRun, type Run } from "../../src/engine";
import { buzzwordFixture, buzzwordFixtureRaw } from "./fixture";

function answer(run: Run, optionId: "pub" | "report") {
  run.choose({ type: "notification", notificationId: "invite", optionId });
  run.choose({ type: "continue" });
}

function openMeeting(run: Run) {
  const view = run.choose({ type: "action", actionId: "meeting" });
  if (view.step.kind !== "scene") throw new Error(view.step.kind);
  return view;
}

describe("a Buzzword in the meeting Scene", () => {
  it("offers its option after the pub", () => {
    const run = startRun({ seed: 1, content: buzzwordFixture() });
    answer(run, "pub");

    const view = openMeeting(run);

    expect(view.step).toMatchObject({
      options: expect.arrayContaining([
        { id: "use-word", label: "Say FIXTURE-TERM" },
      ]) as unknown,
    });
  });

  it("gives no option, and no hint of one, after the report", () => {
    const run = startRun({ seed: 1, content: buzzwordFixture() });
    answer(run, "report");

    const view = openMeeting(run);
    const seen = JSON.stringify(view);

    expect(seen).not.toContain("use-word");
    expect(seen).not.toContain("FIXTURE-TERM");
    expect(() =>
      run.choose({ type: "scene", sceneId: "meeting", optionId: "use-word" }),
    ).toThrow(/not available/i);
  });

  it("has a different result from every other choice", () => {
    const resultOf = (optionId: string) => {
      const run = startRun({ seed: 1, content: buzzwordFixture() });
      answer(run, "pub");
      openMeeting(run);
      return run.choose({ type: "scene", sceneId: "meeting", optionId }).step;
    };

    const buzzword = resultOf("use-word");

    expect(buzzword).toMatchObject({ body: "WORD-LANDED" });
    expect(buzzword).not.toEqual(resultOf("back-ana"));
    expect(buzzword).not.toEqual(resultOf("stay-quiet"));
  });

  it("gates any Scene option through data alone", () => {
    const raw = buzzwordFixtureRaw();
    raw.scenes[0]?.options.push({
      id: "also-gated",
      label: "Another gated option",
      requires: { hasBuzzword: "fixture-word" },
      results: [{ body: "Also gated." }],
    });
    const content = parseContent(raw);

    const offered = (optionId: "pub" | "report") => {
      const run = startRun({ seed: 1, content });
      answer(run, optionId);
      return openMeeting(run).choices;
    };

    const choice = {
      type: "scene",
      sceneId: "meeting",
      optionId: "also-gated",
    };
    expect(offered("pub")).toContainEqual(choice);
    expect(offered("report")).not.toContainEqual(choice);
  });

  it("rejects an option gated on a Buzzword that does not exist", () => {
    const raw = buzzwordFixtureRaw();
    raw.scenes[0]?.options.push({
      id: "broken",
      label: "Broken",
      requires: { hasBuzzword: "no-such-word" },
      results: [{ body: "Never." }],
    });

    expect(() => parseContent(raw)).toThrow(/no-such-word/);
  });

  it("rejects an option gated on the hidden truth, which would leak it", () => {
    const raw = buzzwordFixtureRaw();
    raw.scenes[0]?.options.push({
      id: "leaky",
      label: "Leaky",
      requires: { holderIs: "ana" },
      results: [{ body: "Never." }],
    });

    expect(() => parseContent(raw)).toThrow(/leaky/);
  });
});
