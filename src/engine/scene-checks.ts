import { behavioursOpenTo, type Content, type SceneData } from "./content";
import { isPlace } from "./places";

/**
 * The most words a Scene can show before its options, so that the room is
 * read at a glance: what it is about, its signs, and one line for each person.
 */
export const SCENE_WORD_BUDGET = 120;

/** The most words an option in a Scene can say, so that it fits on one line. */
export const OPTION_WORD_LIMIT = 8;

const PART = /\{\w+\}/g;

/** Words, as a reader counts them: whatever stands between spaces. */
function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w !== "").length;
}

/**
 * The words of text as read: each part, such as `{holder}` or `{plan}`, counts
 * as one word, since a name is taken in at a glance, however long the title.
 */
function wordsRead(text: string): number {
  return wordCount(text.replace(PART, "x"));
}

const most = (counts: number[]) => Math.max(0, ...counts);

/**
 * The most words a Scene can show before its options, however it is dealt: its
 * setup and every sign, and a row for each person who can be present, with the
 * longest line each can show. The boss and the boss's boss each say how they are
 * with you on a line of their own, and everyone else in the same line, unless it
 * is a plain one, which is left out. A quarterly review is staged, so nobody
 * there is seen doing anything.
 */
export function sceneWordsAtMost(content: Content, scene: SceneData): number {
  const words = wordsRead;
  const setup = scene.narration.reduce((sum, line) => sum + words(line), 0);
  const signs = scene.signs.reduce(
    (sum, s) => sum + words(s.label) + words(s.text),
    0,
  );
  const competitor = scene.competitor
    ? words(scene.competitor.label) +
      most(scene.competitor.signs.map((s) => words(s.text)))
    : 0;

  const changeSigns = content.changing?.whistleblower.signs ?? [];
  const lineOf = (character: string) =>
    most(
      [...behavioursOpenTo(content, character), ...changeSigns].map((b) =>
        words(b.text),
      ),
    );
  const anyLine = most(content.characters.map((c) => lineOf(c.id)));
  const present = [...new Set(scene.cast)];
  // Whoever competes asks from the room, and may be someone else besides.
  const rows = present.length + (scene.competitor ? 1 : 0);
  const seen =
    scene.quarter === undefined
      ? present.reduce(
          (sum, c) => sum + (isPlace(c) ? anyLine : lineOf(c)),
          0,
        ) + (scene.competitor ? anyLine : 0)
      : 0;

  const withYou = (signs: readonly { text: string; plain: boolean }[]) =>
    most(signs.filter((s) => !s.plain).map((s) => words(s.text)));
  const regard = withYou(content.reputation?.signs ?? []);
  const boss = Math.max(regard, withYou(content.boss.signs));
  const head = Math.max(regard, withYou(content.overHead?.signs ?? []));
  const withYouAll =
    rows >= 2 ? (rows - 2) * regard + boss + head : rows * Math.max(boss, head);

  return setup + signs + competitor + seen + withYouAll;
}

/** A Scene is read at a glance, and each of its options on one line. */
export function findWordyScenes(content: Content): string[] {
  const problems: string[] = [];
  for (const scene of content.scenes) {
    const owner = `Scene "${scene.id}"`;
    const words = sceneWordsAtMost(content, scene);
    if (words > SCENE_WORD_BUDGET) {
      problems.push(
        `${owner} can show ${String(words)} words before its options, over the budget of ${String(SCENE_WORD_BUDGET)}.`,
      );
    }
    for (const option of scene.options) {
      const said = wordsRead(option.label);
      if (said > OPTION_WORD_LIMIT) {
        problems.push(
          `${owner} option "${option.id}" says ${String(said)} words, over ${String(OPTION_WORD_LIMIT)}.`,
        );
      }
    }
  }
  return problems;
}
