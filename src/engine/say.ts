import type { Content } from "./content";

/** How running text refers to a Character: by what they do, or else by name. */
export function calledBy(content: Content, id: string): string {
  const character = content.characters.find((c) => c.id === id);
  return character?.called ?? character?.name ?? id;
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
