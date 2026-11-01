import { landWithBoss } from "./boss";
import type { Content, Kind, MoveFamily } from "./content";
import { moveProject, type ProjectChange } from "./project";
import type { State } from "./state";

/** Everything a consequence can do, whether a choice or something else caused it. */
export interface Outcome {
  sets?: readonly string[];
  opinion?: number;
  headOpinion?: number;
  approach?: string | undefined;
  reaction?: Readonly<Record<Kind, string>> | undefined;
  project?: ProjectChange | undefined;
}

/** Counts a Move the player made, for how they played. */
export function countMove(state: State, family: MoveFamily | undefined): void {
  if (family) state.played[family] = (state.played[family] ?? 0) + 1;
}

/**
 * The one place a consequence takes effect: sets its flags, moves the Project and
 * lands with both bosses. Returns the sign of how the boss took it, if it has one.
 */
export function applyOutcome(
  state: State,
  content: Content,
  outcome: Outcome,
  label: string,
): string | undefined {
  state.flags.push(...(outcome.sets ?? []));
  state.truth.headOpinion += outcome.headOpinion ?? 0;
  moveProject(state, content, outcome.project);
  return landWithBoss(state, content, outcome, label);
}
