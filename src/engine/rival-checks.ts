import type { Content } from "./content";
import { bossesAtStart, meantBy } from "./places";
import { RIVAL } from "./rivals";

/**
 * What Rivals compete for, and the Moves made by someone in particular: who is
 * named must be there, and only a Rival's Move can say `{rival}`.
 */
export function findBrokenRivals(content: Content): string[] {
  const problems: string[] = [];
  const bosses = bossesAtStart(content);
  const known = (written: string) => {
    const id = meantBy(bosses, written) ?? written;
    return content.characters.some((c) => c.id === id);
  };
  const ids = new Set<string>();
  for (const entry of content.rivals?.competing ?? []) {
    const owner = `What Rivals compete for, "${entry.id}",`;
    if (ids.has(entry.id)) problems.push(`${owner} is written twice.`);
    ids.add(entry.id);
    for (const who of entry.who) {
      if (!known(who)) problems.push(`${owner} names unknown "${who}".`);
    }
  }
  for (const m of content.moves) {
    const owner = `Move "${m.id}"`;
    const byRival = m.by === RIVAL;
    if (byRival && !content.rivals) {
      problems.push(`${owner} is made by a Rival, but no Rivals are written.`);
    }
    if (m.by !== undefined && !byRival && !known(m.by)) {
      problems.push(`${owner} is made by unknown "${m.by}".`);
    }
    if (m.story && m.by === undefined) {
      problems.push(`${owner} tells a false story, so it needs a "by".`);
    }
    if (m.story && !content.reputation?.falseStories) {
      problems.push(`${owner} tells a false story, but none are written.`);
    }
    if (!byRival && m.body.includes(RIVAL)) {
      problems.push(`${owner} says ${RIVAL}, but is not made by a Rival.`);
    }
    if (`${m.from} ${m.title}`.includes(RIVAL)) {
      problems.push(`${owner} can say ${RIVAL} only in its body.`);
    }
  }
  return problems;
}
