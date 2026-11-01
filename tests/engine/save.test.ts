import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  resumeRun,
  startRun,
  UnusableSaveError,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { SAVE_VERSION } from "../../src/engine/save";
import { fixtureRaw } from "./fixture";

/** A scripted player, so that both runs below make the same choices. */
function pickFor(view: PlayerView, turn: number) {
  const choice = view.choices[Math.imul(turn + 1, 40503) % view.choices.length];
  if (!choice) throw new Error("No choice.");
  return choice;
}

function restored(run: Run, content: Content): Run {
  return resumeRun({ save: run.save(), content });
}

/** Any state a later ticket adds that does not survive a save fails this. */
function saveAtEveryStep(seed: number, content: Content) {
  const plain = startRun({ seed, content });
  let reloaded = restored(startRun({ seed, content }), content);
  let view = plain.view();
  expect(reloaded.view()).toEqual(view);
  for (let turn = 0; view.choices.length > 0; turn++) {
    const choice = pickFor(view, turn);
    if (turn % 7 === 0) {
      const character = content.characters[0]?.id ?? "";
      plain.mark(character, "practitioner");
      reloaded.mark(character, "practitioner");
    }
    view = plain.choose(choice);
    reloaded.choose(choice);
    reloaded = restored(reloaded, content);
    expect(JSON.stringify(reloaded.view())).toBe(JSON.stringify(view));
    expect(readHiddenTruth(reloaded)).toEqual(readHiddenTruth(plain));
  }
  expect(view.step.kind).toBe("results");
}

describe("a run saved at every step", () => {
  it.each([1, 2, 4, 8, 13, 16])(
    "matches an unsaved run on the real content, seed %i",
    (seed) => {
      saveAtEveryStep(seed, gameContent);
    },
  );

  it("matches an unsaved run on small content", () => {
    saveAtEveryStep(3, parseContent(fixtureRaw()));
  });

  it("keeps marks, and that one has been taken back", () => {
    const run = startRun({ seed: 1, content: gameContent });
    run.mark("boss", "believer");
    run.mark("boss", null);
    run.mark("analyst", "incompetent");

    const { marks } = restored(run, gameContent).view().notebook;

    expect(marks.find((m) => m.id === "boss")?.mark).toBeNull();
    expect(marks.find((m) => m.id === "analyst")?.mark).toBe("incompetent");
  });

  it("carries the version it was written with", () => {
    const run = startRun({ seed: 1, content: gameContent });
    const parsed = JSON.parse(run.save()) as { version: number };

    expect(parsed.version).toBe(SAVE_VERSION);
  });
});

describe("a save that cannot be used", () => {
  const save = startRun({ seed: 1, content: gameContent }).save();
  const edited = (change: (saved: Record<string, unknown>) => void) => {
    const saved = JSON.parse(save) as Record<string, unknown>;
    change(saved);
    return JSON.stringify(saved);
  };
  const refuses = (text: string, content: Content = gameContent) => {
    expect(() => resumeRun({ save: text, content })).toThrow(UnusableSaveError);
  };

  it("refuses what is not a save at all", () => {
    refuses("not json");
    refuses("null");
    refuses("[]");
    refuses("{}");
  });

  it("refuses another version", () => {
    refuses(
      edited((s) => {
        s.version = SAVE_VERSION - 1;
      }),
    );
  });

  it("refuses a save from other content", () => {
    const other = parseContent({
      ...gameContent,
      ui: { ...gameContent.ui, freeLabel: "Costs nothing, officially" },
    });
    refuses(save, other);
  });

  it("refuses a state that is missing something", () => {
    refuses(
      edited((s) => {
        delete (s.state as Record<string, unknown>).project;
      }),
    );
    refuses(
      edited((s) => {
        s.state = 7;
      }),
    );
    refuses(
      edited((s) => {
        s.state = null;
      }),
    );
    refuses(
      edited((s) => {
        (s.state as { truth: unknown }).truth = null;
      }),
    );
  });

  it("refuses a step that the content does not have", () => {
    refuses(
      edited((s) => {
        (s.state as { step: unknown }).step = {
          kind: "notification",
          id: "nothing-of-the-sort",
        };
      }),
    );
  });
});
