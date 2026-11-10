import { treatBoss } from "./boss";
import { signsOfChange, signsOpenTo } from "./changes";
import { behavioursOpenTo, type ClueVerdict, type Content } from "./content";
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
  namedBy,
  offeredOptions,
} from "./reads";
import { regardOf } from "./reputation";
import { askIn, type HeldScene } from "./asking";
import { competitionNow, noteMoveMade, type Competition } from "./rivals";
import { draw, pickWeighted } from "./rng";
import { calledBy, sayPeople } from "./say";
import {
  IllegalChoiceError,
  type ShownBehaviour,
  type Result,
  type State,
  type Step,
  type World,
} from "./state";
import type { Choice } from "./view";

/**
 * A Scene as it is held now. A place in the cast is whoever is in it, and in a
 * Scene in which someone competing asks, they are in the room too.
 */
export function sceneData(
  state: State,
  world: World,
  id: string,
  competition?: Competition,
): HeldScene {
  const scene = world.content.scenes.find((s) => s.id === id);
  if (!scene) throw new Error(`Unknown Scene "${id}".`);
  const script =
    scene.script === undefined ? undefined : world.sceneScripts[scene.script];
  const shaped = script
    ? script(scene, { powerMap: state.truth.powerMap })
    : scene;
  // Whoever has left is not in the room, and whoever covers for them never chairs.
  const bosses = bossesOf(state, world.content);
  const cast = shaped.cast.flatMap((c) => meantBy(bosses, c) ?? []);
  const room = [...new Set(cast)].filter((c) => !isGone(state, c));
  if (shaped.competitor === undefined) return { ...shaped, cast: room };
  return askIn(
    state,
    world.content,
    shaped,
    room,
    competition ?? competitionNow(state, world.content),
  );
}

/**
 * Everyone present shows one behaviour, open to their role and chosen by their
 * dealt kind. A quarterly review is staged: everyone is on their best behaviour,
 * so it shows only what is written.
 */
export function openScene(
  state: State,
  world: World,
  id: string,
): Extract<Step, { kind: "scene" }> {
  const { content } = world;
  const shown: ShownBehaviour[] = [];
  const competition = competitionNow(state, content);
  const scene = sceneData(state, world, id, competition);
  const { cast, quarter } = scene;
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
  noteScene(state, content, scene, shown, misleading);
  if (scene.competitor !== undefined) {
    noteMoveMade(
      state,
      scene.asker,
      { id, family: scene.competitor.family },
      competition,
    );
  }
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
  content: Content,
  scene: HeldScene,
  shown: readonly ShownBehaviour[],
  misleading: boolean,
): void {
  const note = (text: string, verdict: ClueVerdict, about: string[]) => {
    state.clues.push({
      month: state.month,
      source: scene.title,
      text,
      verdict,
      about,
    });
  };
  for (const sign of scene.signs) {
    if (sign.clue !== undefined) {
      note(
        fillParts(state, content, sign.clue, scene.cast, misleading),
        misleading ? "wrong" : "held",
        namedBy(state, content, sign.clue, scene.cast, misleading),
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
        [character],
      );
    }
    const written = content.behaviours.find((b) => b.id === behaviour);
    const kind = state.truth.characters.find((c) => c.id === character)?.kind;
    if (written?.clue === undefined || kind === undefined) continue;
    const top = Math.max(...Object.values(written.likelihood));
    note(
      sayPeople(written.clue, { "{who}": calledBy(state, content, character) }),
      written.likelihood[kind] === top ? "held" : "wrong",
      [character],
    );
  }
}

export function behaveInScene(
  state: State,
  world: World,
  choice: Extract<Choice, { type: "scene" }>,
): Result {
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
  return {
    kind: "happened",
    title: scene.title,
    body: reply ? `${fill(result.body)} ${reply.body}` : fill(result.body),
    reaction,
    verdict,
    action: state.step.kind === "scene" ? state.step.action : undefined,
  };
}
