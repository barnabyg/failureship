import { KINDS, type Content } from "./content";
import { bossesAtStart, meantBy } from "./places";
import { COMPETITOR, GROUPS } from "./rivals";

type Move = Content["moves"][number];

/**
 * A Move's body as the other checks read it: a Move made by a competitor can
 * name them as `{competitor}`, which is no part of the Scene's cast.
 */
export function withoutMaker(move: Move): string {
  return move.by === COMPETITOR
    ? move.body.replaceAll(COMPETITOR, "")
    : move.body;
}

/**
 * What Rivals compete for, and the Moves made by someone in particular: who is
 * named must be there, only a competitor's Move can say `{competitor}`, and the
 * odds of who makes one must leave every kind possible and no kind settled.
 */
export function findBrokenRivals(content: Content): string[] {
  const problems: string[] = [];
  const bosses = bossesAtStart(content);
  const known = (written: string) => {
    const id = meantBy(bosses, written) ?? written;
    return content.characters.some((c) => c.id === id);
  };
  const written = content.rivals;
  const ids = new Set<string>();
  for (const entry of written?.competing ?? []) {
    const owner = `What Rivals compete for, "${entry.id}",`;
    if (ids.has(entry.id)) problems.push(`${owner} is written twice.`);
    ids.add(entry.id);
    for (const who of entry.who) {
      if (!GROUPS.includes(who) && !known(who)) {
        problems.push(`${owner} names unknown "${who}".`);
      }
    }
  }
  if (written && new Set(KINDS.map((k) => written.makers[k])).size === 1) {
    problems.push("The odds of who makes a Move give no evidence of a kind.");
  }
  const told = content.scenes.flatMap((s) =>
    s.options.flatMap((o) =>
      o.results.flatMap((r) =>
        r.falseStory
          ? [{ owner: `Scene "${s.id}" option "${o.id}"`, story: r.falseStory }]
          : [],
      ),
    ),
  );
  for (const { owner, story } of told) {
    if (story.of === undefined || story.at === undefined) {
      problems.push(
        `${owner} tells a false story, which needs whom it is about and whom it is told to.`,
      );
    }
    for (const who of [story.of ?? "", ...(story.at ?? [])].filter(Boolean)) {
      if (!known(who))
        problems.push(`${owner} tells a story naming unknown "${who}".`);
    }
  }
  const anyStory =
    told.length > 0 || content.moves.some((m) => m.falseStory !== undefined);
  if (anyStory && !content.reputation?.falseStories) {
    problems.push(
      "False stories are told, but reputation has no falseStories.",
    );
  }
  for (const m of content.moves) {
    const owner = `Move "${m.id}"`;
    const byCompetitor = m.by === COMPETITOR;
    if (byCompetitor && !written) {
      problems.push(`${owner} is made by a competitor, but none are written.`);
    }
    if (m.by !== undefined && !byCompetitor && !known(m.by)) {
      problems.push(`${owner} is made by unknown "${m.by}".`);
    }
    if (m.falseStory && m.by === undefined) {
      problems.push(`${owner} tells a false story, so it needs a "by".`);
    }
    const { falseStory } = m;
    if (falseStory && (falseStory.of !== undefined || falseStory.at)) {
      problems.push(`${owner} tells a story about the player, from its maker.`);
    }
    if (!byCompetitor && m.body.includes(COMPETITOR)) {
      problems.push(
        `${owner} says ${COMPETITOR}, but is not made by a competitor.`,
      );
    }
    if (`${m.from} ${m.title}`.includes(COMPETITOR)) {
      problems.push(`${owner} can say ${COMPETITOR} only in its body.`);
    }
  }
  return problems;
}
