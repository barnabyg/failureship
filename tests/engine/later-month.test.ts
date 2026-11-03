import { build, type Rolldown } from "vite";
import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun } from "../../src/engine";
import { plainChoice, playToMonth } from "../../src/ui/later-month";

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
