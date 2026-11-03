import type { Content } from "./content";
import { YOU } from "./deal";
import type { State } from "./state";

/**
 * The places above the player on the Org Chart. Data can name one wherever it
 * says who a choice or a condition concerns, and it means whoever holds it then.
 */
export const PLACES = { boss: "{boss}", head: "{head}" } as const;

export type Place = keyof typeof PLACES;

/** Who holds each place: the player's boss, and the boss's boss if there is one. */
export interface Holders {
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

function managerAtStart(content: Content, id: string): string | undefined {
  if (id === YOU) return content.you.reportsTo;
  return content.characters.find((c) => c.id === id)?.reportsTo;
}

function holdersOn(answersTo: (id: string) => string | undefined): Holders {
  const boss = answersTo(YOU);
  if (boss === undefined) throw new Error("The player answers to nobody.");
  return { boss, head: answersTo(boss) };
}

/** Who is above the player now, read from where they sit on the Org Chart. */
export function holdersOf(state: State, content: Content): Holders {
  return holdersOn((id) => managerOf(state, content, id));
}

/** Who is above the player as a run starts, for checking data before any run. */
export function holdersAtStart(content: Content): Holders {
  return holdersOn((id) => managerAtStart(content, id));
}

export function bossOf(state: State, content: Content): string {
  return holdersOf(state, content).boss;
}

export function headOf(state: State, content: Content): string | undefined {
  return holdersOf(state, content).head;
}

/** Which place someone holds now, if any. */
export function placeOf(
  state: State,
  content: Content,
  id: string,
): Place | undefined {
  const { boss, head } = holdersOf(state, content);
  if (id === boss) return "boss";
  return id === head ? "head" : undefined;
}

export function isPlace(written: string): boolean {
  return Object.values<string>(PLACES).includes(written);
}

/** Whom a holder is written in for, from a run's holders or the starting ones. */
export function resolveOn(holders: Holders, written: string): string {
  if (written === PLACES.boss) return holders.boss;
  if (written === PLACES.head) return holders.head ?? written;
  return written;
}

/** Whoever data means now: the Character it names, or whoever holds the place. */
export function whoIs(state: State, content: Content, written: string): string {
  return isPlace(written)
    ? resolveOn(holdersOf(state, content), written)
    : written;
}
