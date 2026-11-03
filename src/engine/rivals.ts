import type { Content } from "./content";
import { bossesAtStart, bossesOf, meantBy, type Bosses } from "./places";
import { isGone, matches, personOf } from "./reads";
import { drawFor } from "./rng";
import type { State } from "./state";
import type { StepView } from "./view";

/** Data names one of the player's Rivals as this, the way it names a place. */
export const RIVAL = "{rival}";

type Competing = NonNullable<Content["rivals"]>["competing"][number];

/** The Characters an entry names, with whoever is in a place it names. */
function competitorsAmong(bosses: Bosses, entry: Competing): string[] {
  return entry.who.flatMap((written) => meantBy(bosses, written) ?? []);
}

/** Who could compete for anything as a run starts, whatever their kind. */
export function couldCompeteAtStart(content: Content): string[] {
  const bosses = bossesAtStart(content);
  return [
    ...new Set(
      (content.rivals?.competing ?? []).flatMap((entry) =>
        competitorsAmong(bosses, entry),
      ),
    ),
  ];
}

/**
 * The player's Rivals as things stand: every Practitioner competing with them
 * for something, wherever they are on the Org Chart, up to `most` of them, the
 * most influential on the Power Map first.
 */
export function rivalsNow(
  state: State,
  content: Content,
): { character: string; for: string[] }[] {
  const written = content.rivals;
  if (!written) return [];
  const bosses = bossesOf(state, content);
  const competing = new Map<string, string[]>();
  for (const entry of written.competing) {
    if (!matches(state, content, entry.when)) continue;
    for (const id of competitorsAmong(bosses, entry)) {
      const dealt = state.truth.characters.find((c) => c.id === id);
      if (dealt?.kind !== "practitioner" || isGone(state, id)) continue;
      const already = competing.get(id) ?? [];
      if (!already.includes(entry.id))
        competing.set(id, [...already, entry.id]);
    }
  }
  return state.truth.powerMap.order
    .filter((id) => competing.has(id))
    .slice(0, written.most)
    .map((id) => ({ character: id, for: competing.get(id) ?? [] }));
}

/** Keeps a record of everyone who is a Rival now, and of what they compete for. */
export function noteRivals(state: State, content: Content): void {
  for (const rival of rivalsNow(state, content)) {
    const known = state.truth.rivals.find(
      (r) => r.character === rival.character,
    );
    if (!known) {
      state.truth.rivals.push({ ...rival, since: state.month, did: [] });
      continue;
    }
    for (const id of rival.for) {
      if (!known.for.includes(id)) known.for.push(id);
    }
  }
}

/** Whether whoever a Move is written as made by is here to make it. */
export function canMake(
  state: State,
  content: Content,
  by: string | undefined,
): boolean {
  if (by === undefined) return true;
  if (by === RIVAL) return rivalsNow(state, content).length > 0;
  const id = meantBy(bossesOf(state, content), by);
  return id !== undefined && !isGone(state, id);
}

/** Who makes a Move: whoever it names, or one of the player's Rivals, by a draw. */
export function makerOf(
  state: State,
  content: Content,
  move: { id: string; by?: string | undefined },
): string | undefined {
  if (move.by === undefined) return undefined;
  if (move.by !== RIVAL) return meantBy(bossesOf(state, content), move.by);
  const rivals = rivalsNow(state, content);
  const value = drawFor(state.seed, `rival:${move.id}`, state.month);
  return rivals[Math.floor(value * rivals.length)]?.character;
}

/**
 * A Move has landed on the player. If a Rival made it, and it is one of the
 * families of Move, it is what they did to the player.
 */
export function noteMoveMade(
  state: State,
  content: Content,
  maker: string | undefined,
  move: { id: string; family?: string | undefined },
): void {
  noteRivals(state, content);
  const rival = rivalsNow(state, content).some((r) => r.character === maker);
  const record = state.truth.rivals.find((r) => r.character === maker);
  if (rival && record && move.family !== undefined) {
    record.did.push({ month: state.month, move: move.id });
  }
}

/** Each Rival, what they competed for, and the Moves they made against the player. */
export function rivalsInResults(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }>["rivals"] {
  const written = content.rivals;
  if (!written) return [];
  return state.truth.rivals.map((rivalry) => {
    const { name, title } = personOf(state, content, rivalry.character);
    const did = rivalry.did.flatMap(({ month, move }) => {
      const made = content.moves.find((m) => m.id === move);
      if (!made) return [];
      const family = made.family && content.families?.[made.family].label;
      return [{ month, text: made.title, family: family ?? null }];
    });
    return {
      name,
      title,
      since: rivalry.since,
      competed: rivalry.for.flatMap(
        (id) => written.competing.find((c) => c.id === id)?.for ?? [],
      ),
      did,
      didNothing: did.length === 0 ? written.didNothing : null,
    };
  });
}
