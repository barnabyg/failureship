import type { Content, Floor } from "./content";
import type { State } from "./state";

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
