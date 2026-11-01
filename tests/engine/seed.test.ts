import { describe, expect, it } from "vitest";
import { parseSeed, startRun, type Choice } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { closingFixture } from "./fixture";

describe("a seed typed by the player", () => {
  it.each([
    ["0", 0],
    ["42", 42],
    ["  42 ", 42],
    ["4294967295", 4294967295],
  ])("accepts %j", (typed, seed) => {
    expect(parseSeed(typed)).toBe(seed);
  });

  it.each(["", "   ", "abc", "12a", "-1", "1.5", "1e3", "4294967296"])(
    "refuses %j",
    (typed) => {
      expect(parseSeed(typed)).toBeNull();
    },
  );
});

describe("restarting from a seed", () => {
  it("repeats the deal and the outcome after leaving a run part-way", () => {
    const content = closingFixture();
    const script: Choice[] = [
      { type: "notification", notificationId: "invite", optionId: "pub" },
      { type: "continue" },
      { type: "action", actionId: "meeting" },
      { type: "scene", sceneId: "meeting", optionId: "use-word" },
      { type: "continue" },
      { type: "action", actionId: "kettle" },
      { type: "continue" },
      { type: "continue" },
      { type: "continue" },
    ];
    const first = startRun({ seed: 9, content });
    const seen = script.map((choice) => first.choose(choice));
    const truth = readHiddenTruth(first);

    startRun({ seed: 10, content }).choose({
      type: "notification",
      notificationId: "invite",
      optionId: "report",
    });
    const again = startRun({ seed: 9, content });

    expect(script.map((choice) => again.choose(choice))).toEqual(seen);
    expect(readHiddenTruth(again)).toEqual(truth);
  });
});
