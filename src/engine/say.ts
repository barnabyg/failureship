import type { Content } from "./content";
import { bossesOf, placeAmong, PLACES, type Bosses } from "./places";
import type { State } from "./state";

/** The words for whatever place above the player someone is in, if any. */
function placeWords(bosses: Bosses, content: Content, id: string) {
  const place = placeAmong(bosses, id);
  return place === undefined ? undefined : content.places[place];
}

/**
 * How running text refers to a Character: by the place they are in above the
 * player, such as "your boss", or by what they do, or else by name.
 */
export function calledBy(state: State, content: Content, id: string): string {
  const bosses = bossesOf(state, content);
  const moved = state.titles[id];
  if (moved && placeAmong(bosses, id) === undefined) return moved.called;
  return calledAmong(bosses, content, id);
}

/** The same, among these bosses, such as those a run starts with. */
export function calledAmong(
  bosses: Bosses,
  content: Content,
  id: string,
): string {
  const character = content.characters.find((c) => c.id === id);
  return (
    placeWords(bosses, content, id)?.called ??
    character?.called ??
    character?.name ??
    id
  );
}

/** A Character's job title, with the place they are in above the player, if any. */
export function titleOf(state: State, content: Content, id: string): string {
  const own =
    state.titles[id]?.title ??
    content.characters.find((c) => c.id === id)?.title ??
    "";
  const words = placeWords(bossesOf(state, content), content, id);
  return words ? words.title.replaceAll("{title}", own) : own;
}

export function capitalised(phrase: string): string {
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function startsSentence(before: string): boolean {
  return before === "" || /[.!?]"?\s+$/.test(before) || /(^|\s)"$/.test(before);
}

/** Writes people into text, with a capital only where a sentence starts. */
export function sayPeople(
  written: string,
  people: Readonly<Record<string, string>>,
): string {
  return written.replace(/\{\w+\}/g, (token, offset: number) => {
    const phrase = people[token];
    if (phrase === undefined) return token;
    return startsSentence(written.slice(0, offset))
      ? capitalised(phrase)
      : phrase;
  });
}

/** Writes the name of whoever is in each place into a message's `from` line. */
export function sayFrom(state: State, content: Content, from: string): string {
  const { boss, head } = bossesOf(state, content);
  const name = (id: string | undefined) =>
    content.characters.find((c) => c.id === id)?.name ?? "";
  return from
    .replaceAll(PLACES.boss, name(boss))
    .replaceAll(PLACES.head, name(head));
}
