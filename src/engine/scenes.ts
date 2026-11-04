import { treatBoss } from "./boss";
import { signsOfChange, signsOpenTo } from "./changes";
import {
  behavioursOpenTo,
  type ClueVerdict,
  type Content,
  type SceneData,
} from "./content";
import { hearOfPlan } from "./grand-plans";
import { applyOutcome, countMove } from "./outcome";
import { replyToDeal } from "./deals";
import { treatHead } from "./over-head";
import { bossesOf, isGone, meantBy, whoIs } from "./places";
import { replyToPromise } from "./promises";
import {
  fillParts,
  fillSubject,
  heardAbout,
  matches,
  moodOf,
  offeredOptions,
} from "./reads";
import { regardOf } from "./reputation";
import { askerIn, competitionNow, COMPETITOR, noteMoveMade } from "./rivals";
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

/**
 * A Scene as it is held now. A place in the cast is whoever is in it, and
 * whoever of those competing asks in it is in the room too, and is who text
 * calls `{competitor}`, or the bystander if nobody competes.
 */
export function sceneData(state: State, world: World, id: string): SceneData {
  const scene = world.content.scenes.find((s) => s.id === id);
  if (!scene) throw new Error(`Unknown Scene "${id}".`);
  const script =
    scene.script === undefined ? undefined : world.sceneScripts[scene.script];
  const shaped = script
    ? script(scene, { powerMap: state.truth.powerMap })
    : scene;
  // Whoever has left is not in the room, and whoever covers for them never chairs.
  const bosses = bossesOf(state, world.content);
  const asker = askerIn(state, world.content, shaped);
  const cast = [...shaped.cast.flatMap((c) => meantBy(bosses, c) ?? [])];
  if (asker !== undefined) cast.push(asker);
  const room = [...new Set(cast)].filter((c) => !isGone(state, c));
  return shaped.competitor === undefined
    ? { ...shaped, cast: room }
    : { ...askedBy(state, world.content, shaped, asker), cast: room };
}

/** A Scene's text with whoever asks in it written in, by what text calls them. */
function askedBy(
  state: State,
  content: Content,
  scene: SceneData,
  asker: string | undefined,
): SceneData {
  const say = (written: string) =>
    asker === undefined
      ? written.replaceAll(COMPETITOR, "{bystander}")
      : sayPeople(written, { [COMPETITOR]: calledBy(state, content, asker) });
  return {
    ...scene,
    narration: scene.narration.map(say),
    signs: scene.signs.map((sign) => ({
      ...sign,
      text: say(sign.text),
      clue: sign.clue === undefined ? undefined : say(sign.clue),
    })),
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

/**
 * Everyone present shows one behaviour, open to their role and chosen by their
 * dealt kind. A quarterly review is staged: everyone is on their best behaviour,
 * so it shows only what is written.
 */
export function openScene(state: State, world: World, id: string): Step {
  const { content } = world;
  const shown: ShownBehaviour[] = [];
  const { cast, quarter } = sceneData(state, world, id);
  const misleading = drawMisleading(state, world.content);
  if (content.behaviours.length > 0 && quarter === undefined) {
    for (const character of cast) {
      const kind = state.truth.characters.find((c) => c.id === character)?.kind;
      if (kind === undefined) continue;
      // A changed Character's signs follow their new kind.
      const open = signsOpenTo(
        state,
        content,
        character,
        behavioursOpenTo(content, character).map((b) => ({
          id: b.id,
          weight: b.likelihood[kind],
        })),
      );
      const chosen = pickWeighted(state.rng, open, (b) => b.weight);
      state.rng = chosen.next;
      shown.push({ character, behaviour: chosen.item.id });
    }
  }
  noteScene(state, world, id, shown, misleading);
  noteAsker(state, content, id);
  hearOfPlan(state, content, id);
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

/** Whoever of those competing asks in a Scene has made a Move of theirs. */
function noteAsker(state: State, content: Content, id: string): void {
  const scene = content.scenes.find((s) => s.id === id);
  if (scene?.competitor === undefined) return;
  noteMoveMade(
    state,
    askerIn(state, content, scene),
    { id, family: scene.competitor.family },
    competitionNow(state, content),
  );
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
    const own = signsOfChange(state, content, character).find(
      (s) => s.id === behaviour,
    );
    if (own?.clue !== undefined) {
      note(
        sayPeople(own.clue, { "{who}": calledBy(state, content, character) }),
        "held",
      );
    }
    const written = content.behaviours.find((b) => b.id === behaviour);
    const kind = state.truth.characters.find((c) => c.id === character)?.kind;
    if (written?.clue === undefined || kind === undefined) continue;
    const top = Math.max(...Object.values(written.likelihood));
    note(
      sayPeople(written.clue, { "{who}": calledBy(state, content, character) }),
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
    { ...result, promise: option?.promise, deal: option?.deal },
    fill(option?.label ?? ""),
  );
  const verdict = scene.verdict?.[moodOf(state, world.content)];
  if (verdict !== undefined) state.verdict = verdict;
  if (result.factNote !== undefined) {
    const dealt = state.truth.characters.find(
      (c) =>
        c.id ===
        (result.factAt === undefined
          ? heard?.subject
          : whoIs(state, world.content, result.factAt)),
    )?.fact;
    // Acting on a false claim says nothing about the fact they really have.
    const relevant = option?.about === undefined || dealt?.id === option.about;
    state.factEvents.push({
      month: state.month,
      note: fill(result.factNote),
      fact: relevant ? (dealt?.text ?? null) : null,
    });
  }
  const reply =
    replyToPromise(state, world.content, option?.promise) ??
    replyToDeal(state, world.content, option?.deal);
  state.step = {
    kind: "notice",
    title: scene.title,
    body: reply ? `${fill(result.body)} ${reply.body}` : fill(result.body),
    reaction,
    verdict,
  };
}
