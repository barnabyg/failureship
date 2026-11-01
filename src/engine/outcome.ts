import { landWithBoss } from "./boss";
import type { Content, Kind, MoveFamily } from "./content";
import { makeMistake } from "./mistakes";
import { moveProject, type ProjectChange } from "./project";
import { startRisks, startThreads } from "./threads";
import type { State } from "./state";

/** Everything a consequence can do, whether a choice or something else caused it. */
export interface Outcome {
  sets?: readonly string[];
  opinion?: number;
  headOpinion?: number;
  approach?: string | undefined;
  reaction?: Readonly<Record<Kind, string>> | undefined;
  project?: ProjectChange | undefined;
  mistake?: "big" | "catastrophic" | undefined;
  remembers?: readonly { character: string; about: string; text: string }[];
}

/** Counts a Move the player made, for how they played. */
export function countMove(state: State, family: MoveFamily | undefined): void {
  if (family) state.played[family] = (state.played[family] ?? 0) + 1;
}

/**
 * The one place a consequence takes effect: sets its flags, keeps them on
 * the lasting record, starts any Thread or hidden risk they begin, moves the Project, keeps what
 * anyone remembers,
 * counts any big mistake and lands with both bosses. Returns the sign of how the boss took it, if it has one.
 */
export function applyOutcome(
  state: State,
  content: Content,
  outcome: Outcome,
  label: string,
): string | undefined {
  const sets = outcome.sets ?? [];
  state.flags.push(...sets);
  state.deeds.push(...sets.map((flag) => ({ flag, month: state.month })));
  startThreads(state, content, sets);
  startRisks(state, content, sets);
  for (const memory of outcome.remembers ?? []) {
    state.truth.memories.push({ ...memory, month: state.month });
  }
  state.truth.headOpinion += outcome.headOpinion ?? 0;
  moveProject(state, content, outcome.project);
  if (outcome.mistake) makeMistake(state, content, outcome.mistake, label);
  return landWithBoss(state, content, outcome, label);
}
