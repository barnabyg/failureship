import type { Content, Floor } from "./content";
import { drawFor, shuffle } from "./rng";
import type { State } from "./state";

/** Whatever is scheduled: by floor, by the month on it, or from its pool. */
export interface Scheduled {
  id?: string;
  floor?: string | undefined;
  months?: number[] | undefined;
  pool?: boolean | undefined;
}

/** What scheduling reads of a run: the floor the player is on, and how long for. */
export type Whereabouts = Pick<State, "seed" | "job" | "monthsOnFloor">;

/** The floor where a job is done. The checks make sure every job a run can hold has one. */
export function floorOf(content: Content, job: string): Floor {
  const floor = content.floors.find((f) => f.job === job);
  if (!floor) throw new Error(`No floor for job "${job}".`);
  return floor;
}

/** The floor the player is on, which is the floor of their job now. */
export function floorNow(state: State, content: Content): Floor {
  return floorOf(content, state.job);
}

/** Whether a place is one of the rooms on the player's floor. */
export function isOnFloor(
  state: State,
  content: Content,
  place: string,
): boolean {
  return floorNow(state, content).rooms.some((r) => r.id === place);
}

/**
 * The month the player is in on their floor: every month they have spent there,
 * this one included, so that coming back to a floor picks it up where it was left.
 */
export function monthOnFloor(where: Whereabouts): number {
  return where.monthsOnFloor[where.job] ?? 0;
}

/** Counts a new month on the player's floor, as each month opens. */
export function startMonthOnFloor(state: State): void {
  state.monthsOnFloor[state.job] = monthOnFloor(state) + 1;
}

/** Whether something recurs: it belongs to every month, and to no pool. */
export function recurs(item: Scheduled): boolean {
  return item.months === undefined && item.pool !== true;
}

/**
 * A floor's own content: the Scenes, Notifications and Demands that name it,
 * pool items included. Its months are the months the floor is written for.
 */
export function ownContent(content: Content, job: string): Scheduled[] {
  return [
    ...content.scenes,
    ...content.notifications,
    ...(content.demands?.items ?? []),
  ].filter((item) => item.floor === job);
}

/** How many months a floor is written for: up to the last month its own content names. */
export function writtenMonths(content: Content, job: string): number {
  return Math.max(
    0,
    ...ownContent(content, job).flatMap((i) => i.months ?? []),
  );
}

/** One of a floor's pool, for this month: each in a seeded turn, then round again. */
function drawnFrom<T extends { id: string }>(
  where: Whereabouts,
  pool: readonly T[],
  past: number,
  kind: string,
): T | undefined {
  const order = drawFor(where.seed, `pool:${where.job}:${kind}`, 0);
  const { items } = shuffle(Math.floor(order * 2 ** 32), pool);
  return items[(past - 1) % items.length];
}

/** What a floor's pool gives this month, once its written months have run out. */
function poolThisMonth(where: Whereabouts, content: Content): Set<string> {
  const past = monthOnFloor(where) - writtenMonths(content, where.job);
  if (past < 1) return new Set();
  const ofFloor = <T extends Scheduled>(items: readonly T[]) =>
    items.filter((i) => i.pool && i.floor === where.job);
  const drawn = [
    drawnFrom(where, ofFloor(content.scenes), past, "scene"),
    drawnFrom(where, ofFloor(content.notifications), past, "notification"),
  ];
  return new Set(drawn.flatMap((item) => (item ? [item.id] : [])));
}

/**
 * Whether something belongs to this month where the player is: on its floor, if
 * it names one, and in its months there, or drawn from that floor's pool.
 */
export function isOn(
  where: Whereabouts,
  content: Content,
  item: Scheduled,
): boolean {
  if (item.floor !== undefined && item.floor !== where.job) return false;
  if (item.pool) {
    return item.id !== undefined && poolThisMonth(where, content).has(item.id);
  }
  return item.months === undefined || item.months.includes(monthOnFloor(where));
}
