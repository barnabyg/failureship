import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { parseContent, type Content } from "../../src/engine";
import {
  findWordyScenes,
  OPTION_WORD_LIMIT,
  SCENE_WORD_BUDGET,
  sceneWordsAtMost,
} from "../../src/engine/scene-checks";
import { sceneFixture, sceneFixtureRaw } from "./fixture";

const words = (n: number) => Array<string>(n).fill("word").join(" ");

/** The fixture's one Scene, read as the check reads it, in content given. */
function wordsIn(content: Content): number {
  const scene = content.scenes[0];
  if (!scene) throw new Error("The fixture has no Scene.");
  return sceneWordsAtMost(content, scene);
}

const likelihood = { believer: 1, incompetent: 2, practitioner: 3 };
const mood = { warm: 1, neutral: 2, cold: 3 };

describe("a Scene's word budget", () => {
  it("holds every real Scene, and every option in one, within it", () => {
    expect(findWordyScenes(gameContent)).toEqual([]);
    for (const scene of gameContent.scenes) {
      expect(sceneWordsAtMost(gameContent, scene), scene.id).toBeLessThan(
        SCENE_WORD_BUDGET + 1,
      );
    }
  });

  it("refuses a Scene with more to read before its options", () => {
    const raw = sceneFixtureRaw();
    const scene = raw.scenes[0];
    if (!scene) throw new Error("The fixture has no Scene.");
    scene.narration = [words(SCENE_WORD_BUDGET)];

    expect(() => parseContent(raw)).toThrow(
      /Scene "meeting" can show \d+ words before its options, over the budget of 120/,
    );
  });

  it("refuses an option too long for one line", () => {
    const raw = sceneFixtureRaw();
    const option = raw.scenes[0]?.options[1];
    if (!option) throw new Error("The fixture has no second option.");
    option.label = words(OPTION_WORD_LIMIT + 1);

    expect(() => parseContent(raw)).toThrow(
      /option "stay-quiet" says 9 words, over 8/,
    );
  });

  it("counts the setup and every sign, a name as one word", () => {
    const content = sceneFixture();
    const scene = content.scenes[0];
    if (!scene) throw new Error("The fixture has no Scene.");
    const reading = (narration: string, sign: string) => ({
      ...content,
      scenes: [
        {
          ...scene,
          narration: [narration],
          signs: [{ label: "Who", text: sign }],
        },
      ],
    });
    const empty = {
      ...content,
      scenes: [{ ...scene, narration: [], signs: [] }],
    };
    const named = reading("One two three.", "{holder} talks over {ignored}.");

    // Three words of setup, and five of the sign: its label, and four.
    expect(wordsIn(named)).toBe(wordsIn(empty) + 8);
    // A part reads as a name of one word, whoever it turns out to be.
    expect(wordsIn(reading("One two three.", "Ana talks over Ben."))).toBe(
      wordsIn(named),
    );
    expect(
      wordsIn(reading("One two three four.", "Ana Abel talks over Ben.")),
    ).toBe(wordsIn(named) + 2);
  });

  it("counts the longest line that each person present can show", () => {
    const content = sceneFixture();
    const people = new Set(content.scenes[0]?.cast).size;
    const showing = (text: string) => ({
      ...content,
      behaviours: [
        { id: "short", text: "Nods.", likelihood },
        { id: "long", text, likelihood },
      ],
    });

    expect(wordsIn(showing(words(7)))).toBe(
      wordsIn(showing(words(3))) + 4 * people,
    );
  });

  it("counts how the boss is with you, but not a plain line", () => {
    const content = sceneFixture();
    const treating = (signs: Content["boss"]["signs"]) => ({
      ...content,
      boss: { ...content.boss, signs },
    });
    const short = {
      id: "short",
      text: words(2),
      plain: false,
      likelihood: mood,
    };
    const long = { id: "long", text: words(9), plain: false, likelihood: mood };

    expect(wordsIn(treating([short, long]))).toBeGreaterThan(
      wordsIn(treating([short])),
    );
    expect(wordsIn(treating([short, { ...long, plain: true }]))).toBe(
      wordsIn(treating([short])),
    );
  });
});
