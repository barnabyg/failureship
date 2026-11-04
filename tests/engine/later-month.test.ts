import { build, type Rolldown } from "vite";
import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun } from "../../src/engine";
import { endingAt, plainChoice, playToMonth } from "../../src/ui/later-month";

const newRun = (seed = 1) => startRun({ seed, content: gameContent });

describe("the browser tests' later-month start", () => {
  it.each([2, 6, 9])("reaches the start of month %i on any seed", (month) => {
    for (let seed = 1; seed <= 20; seed++) {
      const view = playToMonth(newRun(seed), String(month));

      expect(view.month).toBe(month);
      expect(view.actions.spent).toBe(0);
    }
  });

  it("plays the same run every time", () => {
    const first = playToMonth(newRun(), "6");

    expect(playToMonth(newRun(), "6")).toEqual(first);
  });

  it("takes the options named, each once and in order, and plays plainly otherwise", () => {
    // On seed 4, month 2's Notifications are training and then fewer-meetings,
    // and "fake" is offered again in month 4, where it is not named a second time.
    const run = newRun(4);
    let view = run.view();
    const wanted: Record<string, string> = {
      training: "do-training",
      "fewer-meetings": "fake",
    };
    while (view.month < 6) {
      const { step } = view;
      const optionId =
        step.kind === "notification" ? wanted[step.id] : undefined;
      view = run.choose(
        step.kind === "notification" && optionId
          ? { type: "notification", notificationId: step.id, optionId }
          : plainChoice(view),
      );
    }

    expect(playToMonth(newRun(4), "6", "do-training,fake")).toEqual(view);
    expect(playToMonth(newRun(4), "6", "do-training,fake")).not.toEqual(
      playToMonth(newRun(4), "6"),
    );
  });

  it("refuses to start when a named option is never offered", () => {
    expect(() => playToMonth(newRun(2), "6", "do-training,nothing")).toThrow(
      /never offered "nothing"/,
    );
  });

  it.each([null, "", "0", "-1", "1", "2.5", "19", "soon"])(
    "stays in month 1 when asked for %s",
    (written) => {
      expect(playToMonth(newRun(), written).month).toBe(1);
    },
  );
});

describe("the browser tests' early end", () => {
  /** Plays a run plainly to the end, and gives its last month and its last step. */
  const toTheEnd = (written: string | null) => {
    const run = startRun({ seed: 1, content: endingAt(gameContent, written) });
    let view = run.view();
    let last = view;
    while (view.choices.length > 0) {
      last = view;
      view = run.choose(plainChoice(view));
    }
    return { month: last.month, total: view.totalMonths, end: view.step.kind };
  };

  it("ends the run at the results screen as the month written closes", () => {
    expect(toTheEnd("10")).toEqual({ month: 10, total: 10, end: "results" });
  });

  it.each([null, "", "0", "18", "19", "2.5", "soon"])(
    "leaves the run its eighteen months when asked for %s",
    (written) => {
      expect(toTheEnd(written)).toEqual({
        month: 18,
        total: 18,
        end: "results",
      });
    },
  );

  it("is the game's own content when it changes nothing", () => {
    expect(endingAt(gameContent, "18")).toBe(gameContent);
  });
});

/** The JavaScript `vite build` makes in a mode, in memory, unminified to be quick. */
async function bundle(mode: string) {
  const built = await build({
    mode,
    logLevel: "silent",
    build: { write: false, minify: false },
  });
  const { output } = built as Rolldown.RolldownOutput;
  return output.flatMap((o) => (o.type === "chunk" ? [o.code] : [])).join("\n");
}

describe("what each build holds of the later-month start", () => {
  const marker = "Later-month start stuck";

  it("is in the test build, and in no other", async () => {
    // Not toContain, which would print the whole bundle on a failure.
    expect((await bundle("e2e")).includes(marker)).toBe(true);
    expect((await bundle("production")).includes(marker)).toBe(false);
  });
});
