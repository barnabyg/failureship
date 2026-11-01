import { treatBoss } from "./boss";
import { behavioursOpenTo, type ClueVerdict, type Content } from "./content";
import { applyOutcome, countMove } from "./outcome";
import { treatHead } from "./over-head";
import {
  fillParts,
  fillSubject,
  heardAbout,
  matches,
  moodOf,
  offeredOptions,
  sceneData,
} from "./reads";
import { regardOf } from "./reputation";
import { draw, pickWeighted } from "./rng";
import { calledBy, sayPeople } from "./say";
import {
  IllegalChoiceError,
  type ShownBehaviour,
  type State,
  type Step,
  type World,
} from "./state";
import type { Choice } from "./view";

/** Everyone present shows one behaviour, open to their role and chosen by their dealt kind. */
export function openScene(state: State, world: World, id: string): Step {
  const { content } = world;
  const shown: ShownBehaviour[] = [];
  const { cast } = sceneData(state, world, id);
  const misleading = drawMisleading(state, world.content);
  if (content.behaviours.length > 0) {
    for (const character of cast) {
      const kind = state.truth.characters.find((c) => c.id === character)?.kind;
      if (kind === undefined) continue;
      const chosen = pickWeighted(
        state.rng,
        behavioursOpenTo(content, character),
        (b) => b.likelihood[kind],
      );
      state.rng = chosen.next;
      shown.push({ character, behaviour: chosen.item.id });
    }
  }
  noteScene(state, world, id, shown, misleading);
  return {
    kind: "scene",
    id,
    shown,
    treatment: treatBoss(state, world, cast),
    headTreatment: treatHead(state, content, cast),
    regard: regardOf(state, content, cast),
    misleading,
  };
}

/** Sometimes a room gives the wrong impression, so no one Scene settles it. */
function drawMisleading(state: State, content: Content): boolean {
  const chance = content.balance.signsMisleadChance;
  if (chance === 0) return false;
  const { value, next } = draw(state.rng);
  state.rng = next;
  return value < chance;
}

/** The Notebook keeps only the signs written with a clue. */
function noteScene(
  state: State,
  world: World,
  id: string,
  shown: readonly ShownBehaviour[],
  misleading: boolean,
): void {
  const { content } = world;
  const scene = sceneData(state, world, id);
  const note = (text: string, verdict: ClueVerdict) => {
    state.clues.push({
      month: state.month,
      source: scene.title,
      text,
      verdict,
    });
  };
  for (const sign of scene.signs) {
    if (sign.clue !== undefined) {
      note(
        fillParts(state, content, sign.clue, scene.cast, misleading),
        misleading ? "wrong" : "held",
      );
    }
  }
  for (const { character, behaviour } of shown) {
    const written = content.behaviours.find((b) => b.id === behaviour);
    const kind = state.truth.characters.find((c) => c.id === character)?.kind;
    if (written?.clue === undefined || kind === undefined) continue;
    const top = Math.max(...Object.values(written.likelihood));
    note(
      sayPeople(written.clue, { "{who}": calledBy(content, character) }),
      written.likelihood[kind] === top ? "held" : "wrong",
    );
  }
}

export function behaveInScene(
  state: State,
  world: World,
  choice: Extract<Choice, { type: "scene" }>,
): void {
  const scene = sceneData(state, world, choice.sceneId);
  const option = offeredOptions(state, world.content, scene).find(
    (o) => o.id === choice.optionId,
  );
  const result = option?.results.find((r) =>
    matches(state, world.content, r.when, scene.cast),
  );
  if (!result) throw new IllegalChoiceError(choice.optionId);
  countMove(state, option?.family);
  const heard = heardAbout(state, option?.about);
  const fill = (written: string) =>
    fillSubject(
      state,
      world.content,
      option?.about,
      fillParts(state, world.content, written, scene.cast),
    );
  const reaction = applyOutcome(
    state,
    world.content,
    result,
    fill(option?.label ?? ""),
  );
  const verdict = scene.verdict?.[moodOf(state, world.content)];
  if (verdict !== undefined) state.verdict = verdict;
  if (result.factNote !== undefined) {
    const dealt = state.truth.characters.find(
      (c) => c.id === (result.factAt ?? heard?.subject),
    )?.fact;
    // Acting on a false claim says nothing about the fact they really have.
    const relevant = option?.about === undefined || dealt?.id === option.about;
    state.factEvents.push({
      month: state.month,
      note: fill(result.factNote),
      fact: relevant ? (dealt?.text ?? null) : null,
    });
  }
  state.step = {
    kind: "notice",
    title: scene.title,
    body: fill(result.body),
    reaction,
    verdict,
  };
}
