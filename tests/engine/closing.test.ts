import { describe, expect, it } from "vitest";
import { parseContent, startRun, type Choice } from "../../src/engine";
import { closingFixture, closingFixtureRaw } from "./fixture";

const pub: Choice = {
  type: "notification",
  notificationId: "invite",
  optionId: "pub",
};
const report: Choice = {
  type: "notification",
  notificationId: "invite",
  optionId: "report",
};
const next: Choice = { type: "continue" };
const meeting: Choice = { type: "action", actionId: "meeting" };
const kettle: Choice = { type: "action", actionId: "kettle" };
const inScene = (optionId: string): Choice => ({
  type: "scene",
  sceneId: "meeting",
  optionId,
});

function play(seed: number, script: Choice[], content = closingFixture()) {
  const run = startRun({ seed, content });
  return [run.view(), ...script.map((choice) => run.choose(choice))];
}

/** Answers the Notification, attends the meeting and spends the last action. */
const month = (answer: Choice, optionId: string): Choice[] => [
  answer,
  next,
  meeting,
  inScene(optionId),
  next,
  kettle,
  next,
];

function endOf(seed: number, script: Choice[]) {
  const run = startRun({ seed, content: closingFixture() });
  for (const choice of script) run.choose(choice);
  const move = run.view();
  const story = run.choose(next);
  return { move, story };
}

function story(seed: number, script: Choice[]) {
  const { step } = endOf(seed, script).story;
  if (step.kind !== "story") throw new Error(step.kind);
  return step;
}

describe("the end of the month", () => {
  it("lands a Character Move after the last action and before the close", () => {
    const kinds = play(1, [...month(report, "stay-quiet"), next]).map(
      (v) => v.step.kind,
    );

    expect(kinds.slice(-3)).toEqual(["notice", "move", "story"]);
    expect(kinds.indexOf("move")).toBe(kinds.length - 2);
  });

  it("shows the Move as something that happened, not a choice", () => {
    const view = play(1, month(report, "stay-quiet")).at(-1);

    expect(view?.step).toMatchObject({ kind: "move" });
    expect(view?.choices).toEqual([{ type: "continue" }]);
  });

  it("runs the whole month in the defined order", () => {
    const kinds = play(1, [...month(pub, "use-word"), next]).map(
      (v) => v.step.kind,
    );

    expect(kinds).toEqual([
      "notification",
      "dialog",
      "actions",
      "scene",
      "notice",
      "actions",
      "notice",
      "move",
      "story",
    ]);
  });

  it("will not land a Move while actions remain", () => {
    const views = play(1, [report, next, kettle, next]);

    expect(views.map((v) => v.step.kind)).not.toContain("move");
  });

  it("only lands a Move whose condition holds", () => {
    const raw = closingFixtureRaw();
    raw.moves = raw.moves.filter((m) => m.id === "word-stolen");
    const content = parseContent(raw);

    const withWord = play(1, month(pub, "use-word"), content);
    const withoutWord = play(1, month(pub, "stay-quiet"), content);

    expect(withWord.at(-1)?.step.kind).toBe("move");
    expect(withoutWord.at(-1)?.step.kind).toBe("story");
  });

  it("varies the Move with the seed", () => {
    const titles = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
        const { step } = endOf(seed, month(report, "stay-quiet")).move;
        return step.kind === "move" ? step.title : step.kind;
      }),
    );

    expect(titles).toEqual(new Set(["MOVE-CREDIT", "MOVE-STEAL"]));
  });

  it("gives the same Move and story for the same seed and choices", () => {
    const script = month(pub, "use-word");

    expect(endOf(5, script)).toEqual(endOf(5, script));
  });

  it("tells a different story after the report and after the pub", () => {
    const afterReport = story(1, month(report, "stay-quiet"));
    const afterPub = story(1, month(pub, "stay-quiet"));

    expect(afterReport.reported).toContain("REPORTED-FILED");
    expect(afterReport.reported).not.toContain("REPORTED-PUB");
    expect(afterPub.reported).toContain("REPORTED-PUB");
    expect(afterPub.reported).not.toContain("REPORTED-FILED");
  });

  it("tells a different story for each choice in the Scene", () => {
    const after = (optionId: string) =>
      story(1, month(pub, optionId)).reported.join();

    const stories = ["stay-quiet", "back-ana", "use-word"].map(after);

    expect(new Set(stories).size).toBe(3);
  });

  it("can tell a different story under a different hidden truth", () => {
    const stories = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        story(seed, month(report, "back-ana")).reported.join(),
      ),
    );

    expect(stories.size).toBe(2);
  });

  it("sets what was reported beside what happened", () => {
    const { reported, happened } = story(1, month(report, "stay-quiet"));

    expect(reported).toContain("The team met its objectives.");
    expect(reported).toContain("REPORTED-FILED");
    expect(happened).toEqual(["HAPPENED-FILED"]);
  });

  it("lets a Move change the story, including through negated conditions", () => {
    const raw = closingFixtureRaw();
    raw.moves = raw.moves.filter((m) => m.id === "word-stolen");
    const content = parseContent(raw);

    const final = play(1, [...month(pub, "use-word"), next], content).at(-1);

    expect(final?.step).toMatchObject({
      kind: "story",
      happened: expect.arrayContaining(["HAPPENED-WORD-STOLEN"]) as unknown,
    });
    expect(JSON.stringify(final?.step)).not.toContain("REPORTED-WORD-KEPT");
  });

  it("changes the Move and the story through data alone", () => {
    const raw = closingFixtureRaw();
    raw.moves = [
      { id: "only", from: "Data", title: "New Move", body: "From data." },
    ];
    raw.officialStory.entries = [{ reported: "A new official line." }];
    const content = parseContent(raw);

    const views = play(1, [...month(report, "stay-quiet"), next], content);

    expect(views.at(-2)?.step).toMatchObject({ title: "New Move" });
    expect(views.at(-1)?.step).toMatchObject({
      reported: ["A new official line."],
      happened: [],
    });
  });

  it("rejects a story entry that says nothing", () => {
    const raw = closingFixtureRaw();
    raw.officialStory.entries.push({ when: { flag: "filed" } });

    expect(() => parseContent(raw)).toThrow(/entry/i);
  });
});
