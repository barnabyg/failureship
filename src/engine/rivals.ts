import type { Content, Kind } from "./content";
import {
  bossesAtStart,
  bossesOf,
  managerAtStart,
  managerOf,
  meantBy,
  type Bosses,
} from "./places";
import { isGone, matches, personOf } from "./reads";
import { drawFor, pickWeighted } from "./rng";
import type { State } from "./state";
import type { StepView } from "./view";

/**
 * Data names one of those competing with the player as this, the way it names a
 * place: whoever makes a Move by `{competitor}` is drawn from them, by kind.
 */
export const COMPETITOR = "{competitor}";

/** Whoever shares the player's boss on the Org Chart, as things stand. */
export const PEERS = "{peers}";

/** Everyone still in the company, whatever their place. */
export const EVERYONE = "{everyone}";

/** The groups that `who` can name, read from the Org Chart rather than written. */
export const GROUPS: readonly string[] = [PEERS, EVERYONE];

type Competing = NonNullable<Content["rivals"]>["competing"][number];

/** How to read the Org Chart: as it is now, or as a run starts. */
interface Chart {
  bosses: Bosses;
  answersTo: (id: string) => string | undefined;
  everyone: string[];
}

/** The Characters an entry names: by name, by place, or by group. */
function competitorsOn(chart: Chart, entry: Competing): string[] {
  const { bosses, answersTo, everyone } = chart;
  return entry.who.flatMap((written) => {
    if (written === EVERYONE) return everyone;
    if (written === PEERS) {
      return everyone.filter(
        (id) => id !== bosses.boss && answersTo(id) === bosses.boss,
      );
    }
    const id = meantBy(bosses, written);
    return id !== undefined && everyone.includes(id) ? [id] : [];
  });
}

/** Who could compete for anything as a run starts, whatever their kind. */
export function couldCompeteAtStart(content: Content): string[] {
  const chart: Chart = {
    bosses: bossesAtStart(content),
    answersTo: (id) => managerAtStart(content, id),
    everyone: content.characters.map((c) => c.id),
  };
  return [
    ...new Set(
      (content.rivals?.competing ?? []).flatMap((e) => competitorsOn(chart, e)),
    ),
  ];
}

/** Someone competing with the player, for what, and their dealt kind. */
interface Competitor {
  character: string;
  for: string[];
  kind: Kind;
}

/**
 * Who is competing with the player as things stand, whatever their kind, most
 * influential first, and which of them are Rivals: the Practitioners, up to
 * `most` of them.
 */
export interface Competition {
  competing: Competitor[];
  rivals: Competitor[];
}

export function competitionNow(state: State, content: Content): Competition {
  const written = content.rivals;
  if (!written) return { competing: [], rivals: [] };
  const chart: Chart = {
    bosses: bossesOf(state, content),
    answersTo: (id) => managerOf(state, content, id),
    everyone: content.characters
      .map((c) => c.id)
      .filter((id) => !isGone(state, id)),
  };
  const competing = new Map<string, string[]>();
  for (const entry of written.competing) {
    if (!matches(state, content, entry.when)) continue;
    for (const id of competitorsOn(chart, entry)) {
      const already = competing.get(id) ?? [];
      if (!already.includes(entry.id)) {
        competing.set(id, [...already, entry.id]);
      }
    }
  }
  const all = state.truth.powerMap.order.flatMap((id) => {
    const kind = state.truth.characters.find((c) => c.id === id)?.kind;
    const what = competing.get(id);
    return kind && what ? [{ character: id, for: what, kind }] : [];
  });
  return {
    competing: all,
    rivals: all.filter((c) => c.kind === "practitioner").slice(0, written.most),
  };
}

/** The player's Rivals as things stand. */
export function rivalsNow(state: State, content: Content): Competitor[] {
  return competitionNow(state, content).rivals;
}

/** Keeps a record of everyone who is a Rival, and of what they compete for. */
export function noteRivals(
  state: State,
  { rivals }: Competition = { competing: [], rivals: [] },
): void {
  for (const rival of rivals) {
    const known = state.truth.rivals.find(
      (r) => r.character === rival.character,
    );
    if (!known) {
      state.truth.rivals.push({
        character: rival.character,
        for: [...rival.for],
        since: state.month,
        did: [],
      });
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
  competition: Competition,
): boolean {
  if (by === undefined) return true;
  if (by === COMPETITOR) return competition.competing.length > 0;
  const id = meantBy(bossesOf(state, content), by);
  return id !== undefined && !isGone(state, id);
}

/**
 * Who makes a Move: whoever it names, or someone competing with the player,
 * drawn by the odds for their kind, so that a Rival is likelier but never sure.
 */
export function makerOf(
  state: State,
  content: Content,
  move: { id: string; by?: string | undefined },
  { competing }: Competition,
): string | undefined {
  if (move.by === undefined) return undefined;
  if (move.by !== COMPETITOR) {
    return meantBy(bossesOf(state, content), move.by);
  }
  const odds = content.rivals?.makers;
  if (!odds || competing.length === 0) return undefined;
  const value = drawFor(state.seed, `maker:${move.id}`, state.month);
  return pickWeighted(
    Math.floor(value * 2 ** 32),
    competing,
    (c) => odds[c.kind],
  ).item.character;
}

/**
 * A Move has landed on the player. If a Rival made it, and it is one of the
 * families of Move, it is what they did to the player.
 */
export function noteMoveMade(
  state: State,
  maker: string | undefined,
  move: { id: string; family?: string | undefined },
  competition: Competition,
): void {
  noteRivals(state, competition);
  const rival = competition.rivals.some((r) => r.character === maker);
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
