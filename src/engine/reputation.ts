import type { Content, Tone } from "./content";
import { bossOf, placeOf } from "./places";
import { moodOfCharacter, shiftBelief } from "./reads";
import { drawFor, pickWeighted } from "./rng";
import type { Memory, State } from "./state";

/** What reaches someone stays with them, and moves what they believe of the player. */
export function remember(
  state: State,
  content: Content,
  memory: Pick<Memory, "character" | "about" | "text" | "tone"> &
    Partial<Pick<Memory, "via" | "hops" | "news">>,
): void {
  state.truth.memories.push({
    via: null,
    hops: 0,
    news: null,
    foundOut: null,
    ...memory,
    month: state.month,
  });
  const travel = content.reputation?.travel;
  if (memory.tone && travel) {
    const shift = travel.shift[memory.tone];
    shiftBelief(state, memory.character, shift);
    if (memory.character === bossOf(state, content)) {
      state.bossLandings.push({
        month: state.month,
        boss: memory.character,
        choice: memory.text,
        shift,
      });
    }
  }
}

/** A deed done in front of someone, or to them, is known to them at once. */
export function startNews(
  state: State,
  content: Content,
  news: {
    about: string;
    tone: Tone;
    text: string;
    at: readonly string[];
    word?: { victim: string; what: string };
  },
): number {
  const id = state.truth.news.length;
  const { about, tone, text, word } = news;
  state.truth.news.push({ about, tone, text, month: state.month, word });
  for (const character of news.at) {
    remember(state, content, {
      character,
      about,
      text,
      tone,
      via: null,
      hops: 0,
      news: id,
    });
  }
  return id;
}

/**
 * A false story about the player, made up by someone. It starts with them, and
 * they know better than to believe it, so it moves nobody's belief until it is
 * passed on, as true news is.
 */
export function startStory(
  state: State,
  content: Content,
  story: { about: string; text: string; by: string },
): void {
  const { about, text, by } = story;
  const id = state.truth.news.length;
  state.truth.news.push({
    about,
    tone: "bad",
    text,
    month: state.month,
    startedBy: by,
  });
  remember(state, content, { character: by, about, text, news: id });
}

/** Whoever has a tie of influence to this person, in either direction. */
export function tiedTo(state: State, id: string): string[] {
  return state.truth.powerMap.influence.flatMap((tie) => {
    if (tie.who === id) return [tie.over];
    return tie.over === id ? [tie.who] : [];
  });
}

/**
 * As a month opens, news moves along the Power Map, by named draws: true deeds,
 * and false stories, by the same route. Someone who has seen through a false
 * story first stops believing it, and passes it on no further.
 */
export function spreadNews(state: State, content: Content): void {
  const travel = content.reputation?.travel;
  if (!travel) return;
  findOutStories(state, content);
  for (let step = 0; step < travel.hopsPerMonth; step++) {
    // Those who heard this month have to wait to pass it on, step by step.
    const heard = state.truth.memories.filter(
      (m) => m.news !== null && m.hops < travel.maxHops && m.foundOut === null,
    );
    for (const from of heard) {
      const { news } = from;
      if (news === null) continue;
      for (const to of tiedTo(state, from.character)) {
        const knows = state.truth.memories.some(
          (m) => m.news === news && m.character === to,
        );
        if (knows) continue;
        const name = `news:${String(news)}:${from.character}:${to}`;
        if (drawFor(state.seed, name, state.month) >= travel.passOnChance) {
          continue;
        }
        remember(state, content, {
          character: to,
          about: from.about,
          text: from.text,
          tone: state.truth.news[news]?.tone,
          via: from.character,
          hops: from.hops + 1,
          news,
        });
      }
    }
  }
}

/**
 * Anyone who heard a false story can see through it, by a seeded draw for their
 * kind, and then believes of the player what they did before they heard it.
 */
function findOutStories(state: State, content: Content): void {
  const written = content.reputation;
  if (!written?.falseStories) return;
  for (const memory of state.truth.memories) {
    const story = state.truth.news[memory.news ?? -1];
    const told = memory.tone !== undefined && memory.month < state.month;
    if (story?.startedBy === undefined || memory.foundOut !== null || !told) {
      continue;
    }
    const kind = state.truth.characters.find(
      (c) => c.id === memory.character,
    )?.kind;
    if (kind === undefined) continue;
    const name = `found-out:${String(memory.news)}:${memory.character}`;
    if (
      drawFor(state.seed, name, state.month) >=
      written.falseStories.foundOut[kind]
    ) {
      continue;
    }
    memory.foundOut = state.month;
    const shift = -written.travel.shift[story.tone];
    shiftBelief(state, memory.character, shift);
    if (memory.character === bossOf(state, content)) {
      state.bossLandings.push({
        month: state.month,
        boss: memory.character,
        choice: memory.text,
        shift,
      });
    }
  }
}

/**
 * One sign of how each person present is with the player. It has a draw of its
 * own, and is shown of everyone, so that it says nothing of how it reached them.
 */
export function regardOf(
  state: State,
  content: Content,
  cast: readonly string[],
): { character: string; sign: string }[] {
  const written = content.reputation;
  if (!written) return [];
  return cast
    .filter((character) => placeOf(state, content, character) === undefined)
    .map((character) => {
      const mood = moodOfCharacter(state, content, character);
      const value = drawFor(state.seed, `regard:${character}`, state.month);
      const chosen = pickWeighted(
        Math.floor(value * 2 ** 32),
        written.signs,
        (s) => s.likelihood[mood],
      );
      return { character, sign: chosen.item.id };
    });
}
