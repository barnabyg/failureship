import type { Content, Tone } from "./content";
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
    ...memory,
    month: state.month,
  });
  const travel = content.reputation?.travel;
  if (memory.tone && travel) {
    const shift = travel.shift[memory.tone];
    shiftBelief(state, memory.character, shift);
    if (memory.character === content.boss.character) {
      state.bossLandings.push({
        month: state.month,
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
  news: { about: string; tone: Tone; text: string; at: readonly string[] },
): void {
  const id = state.truth.news.length;
  const { about, tone, text } = news;
  state.truth.news.push({ about, tone, text, month: state.month });
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
}

/** Whoever has a tie of influence to this person, in either direction. */
function tiedTo(state: State, id: string): string[] {
  return state.truth.powerMap.influence.flatMap((tie) => {
    if (tie.who === id) return [tie.over];
    return tie.over === id ? [tie.who] : [];
  });
}

/**
 * As a month opens, news moves along the Power Map, by named draws. Only true
 * deeds start news for now, but a false story could be sent down the same route.
 */
export function spreadNews(state: State, content: Content): void {
  const travel = content.reputation?.travel;
  if (!travel) return;
  for (let step = 0; step < travel.hopsPerMonth; step++) {
    // Those who heard this month have to wait to pass it on, step by step.
    const heard = state.truth.memories.filter(
      (m) => m.news !== null && m.hops < travel.maxHops,
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
          tone: from.tone,
          via: from.character,
          hops: from.hops + 1,
          news,
        });
      }
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
  const own = [content.boss.character, content.overHead?.character];
  return cast
    .filter((character) => !own.includes(character))
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
