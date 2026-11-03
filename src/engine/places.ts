import type { Content } from "./content";
import { YOU } from "./deal";
import type { State } from "./state";

/**
 * The two places above the player on the Org Chart: their boss, and their boss's
 * boss. Data can name one wherever it says who a choice or a condition concerns,
 * and it means whoever is in that place at the time.
 */
export const PLACES = { boss: "{boss}", head: "{head}" } as const;

export type Place = keyof typeof PLACES;

/** Who is in each place: the player's boss, and the boss's boss if there is one. */
export interface Bosses {
  boss: string;
  head: string | undefined;
}

/** Who someone answers to on the Org Chart now, the player included. */
export function managerOf(
  state: State,
  content: Content,
  id: string,
): string | undefined {
  return state.reportsTo[id] ?? managerAtStart(content, id);
}

export function managerAtStart(
  content: Content,
  id: string,
): string | undefined {
  if (id === YOU) return content.you.reportsTo;
  return content.characters.find((c) => c.id === id)?.reportsTo;
}

function bossesOn(answersTo: (id: string) => string | undefined): Bosses {
  const boss = answersTo(YOU);
  if (boss === undefined) throw new Error("The player answers to nobody.");
  return { boss, head: answersTo(boss) };
}

/** Who is above the player now, read from where they sit on the Org Chart. */
export function bossesOf(state: State, content: Content): Bosses {
  return bossesOn((id) => managerOf(state, content, id));
}

/** Who is above the player as a run starts, for checking data before any run. */
export function bossesAtStart(content: Content): Bosses {
  return bossesOn((id) => managerAtStart(content, id));
}

export function bossOf(state: State, content: Content): string {
  return bossesOf(state, content).boss;
}

export function headOf(state: State, content: Content): string | undefined {
  return bossesOf(state, content).head;
}

/** Which place someone is in, among these bosses, if any. */
export function placeAmong(bosses: Bosses, id: string): Place | undefined {
  if (id === bosses.boss) return "boss";
  return id === bosses.head ? "head" : undefined;
}

/** Which place someone is in now, if any. */
export function placeOf(
  state: State,
  content: Content,
  id: string,
): Place | undefined {
  return placeAmong(bossesOf(state, content), id);
}

export function isPlace(written: string): boolean {
  return Object.values<string>(PLACES).includes(written);
}

/**
 * The Character that data means, among these bosses: the one it names, or
 * whoever is in the place it names. Undefined if nobody is in that place.
 */
export function meantBy(bosses: Bosses, written: string): string | undefined {
  if (written === PLACES.boss) return bosses.boss;
  if (written === PLACES.head) return bosses.head;
  return written;
}

/** The Character that data means now. The checks make sure there is one. */
export function whoIs(state: State, content: Content, written: string): string {
  if (!isPlace(written)) return written;
  const id = meantBy(bossesOf(state, content), written);
  if (id === undefined) throw new Error(`Nobody is in the place ${written}.`);
  return id;
}
