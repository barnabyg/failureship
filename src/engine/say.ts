import type { Content } from "./content";
import { holdersOf, PLACES, placeOf } from "./places";
import type { State } from "./state";

/**
 * How running text refers to a Character: by the place they hold above the
 * player, such as "your boss", or by what they do, or else by name.
 */
export function calledBy(state: State, content: Content, id: string): string {
  const place = placeOf(state, content, id);
  const held = place === undefined ? undefined : content.places[place];
  const character = content.characters.find((c) => c.id === id);
  return held?.called ?? character?.called ?? character?.name ?? id;
}

/** A Character's job title, with the place they hold above the player, if any. */
export function titleOf(state: State, content: Content, id: string): string {
  const place = placeOf(state, content, id);
  const held = place === undefined ? undefined : content.places[place];
  const own = content.characters.find((c) => c.id === id)?.title ?? "";
  return held ? held.title.replaceAll("{title}", own) : own;
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

/** Writes the name of whoever holds each place into a message's `from` line. */
export function sayFrom(state: State, content: Content, from: string): string {
  const { boss, head } = holdersOf(state, content);
  const name = (id: string | undefined) =>
    content.characters.find((c) => c.id === id)?.name ?? "";
  return from
    .replaceAll(PLACES.boss, name(boss))
    .replaceAll(PLACES.head, name(head));
}
