import type { Content, SceneData } from "./content";
import { kindOf, partsIn } from "./reads";
import { COMPETITOR, competitorFor, type Competition } from "./rivals";
import { drawFor, pickWeighted } from "./rng";
import { calledBy, sayPeople } from "./say";
import type { State } from "./state";

/** A sign as it is held: whoever it named as `{competitor}` is written in. */
export type HeldSign = SceneData["signs"][number] & {
  /** Who it named as `{competitor}`, if it did. */
  competing?: string | undefined;
};

/** A Scene as it is held, with whoever of those competing asks in it, if anyone does. */
export type HeldScene = Omit<SceneData, "signs"> & {
  signs: HeldSign[];
  /** Who asks, if the Scene has someone competing ask, and anyone competes. */
  asker?: string | undefined;
};

/**
 * Someone competing with the player asks in a Scene written with `competitor`,
 * drawn as a competitor's Move is made, and is in the room. Text says them as
 * `{competitor}`, and one of its signs shows how they went about it, by the odds
 * for their kind. With nobody competing, the bystander asks, in every line, so
 * that the narration and the signs never name different people.
 */
export function askIn(
  state: State,
  content: Content,
  scene: SceneData,
  room: readonly string[],
  competition: Competition,
): HeldScene {
  const { competitor } = scene;
  if (competitor === undefined) return { ...scene, cast: [...room] };
  const drawn = competitorFor(state, content, `asker:${scene.id}`, competition);
  const cast = drawn === undefined ? [...room] : [...new Set([...room, drawn])];
  const asking = drawn ?? partsIn(state.truth.powerMap, cast).bystander;
  const say = (written: string) =>
    sayPeople(written, {
      [COMPETITOR]:
        asking === undefined ? "" : calledBy(state, content, asking),
    });
  const way =
    asking === undefined
      ? undefined
      : pickWeighted(
          Math.floor(
            drawFor(state.seed, `asked:${scene.id}`, state.month) * 2 ** 32,
          ),
          competitor.signs,
          (s) => s.likelihood[kindOf(state, asking)],
        ).item;
  return {
    ...scene,
    cast,
    asker: drawn,
    narration: scene.narration.map(say),
    signs: [
      ...(way
        ? [{ label: competitor.label, text: say(way.text), competing: asking }]
        : []),
      ...scene.signs.map((sign) => ({
        ...sign,
        text: say(sign.text),
        clue: sign.clue === undefined ? undefined : say(sign.clue),
        competing: sign.text.includes(COMPETITOR) ? asking : undefined,
      })),
    ],
    options: scene.options.map((option) => ({
      ...option,
      label: say(option.label),
      results: option.results.map((result) => ({
        ...result,
        body: say(result.body),
        factNote:
          result.factNote === undefined ? undefined : say(result.factNote),
      })),
    })),
  };
}
