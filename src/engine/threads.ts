import type { Content } from "./content";
import { drawFor } from "./rng";
import type { State } from "./state";

/** A month to come, by a named draw, which leaves the shared random state alone. */
function monthAfter(
  state: State,
  name: string,
  { min, max }: { min: number; max: number },
): number {
  const wait = drawFor(state.seed, name, state.month);
  return state.month + min + Math.floor(wait * (max - min + 1));
}

/** Starts any Thread this flag begins, once in a run. It may never come back. */
export function startThreads(
  state: State,
  content: Content,
  flags: readonly string[],
): void {
  for (const thread of content.threads) {
    if (
      !flags.includes(thread.startedBy) ||
      state.threads.some((t) => t.id === thread.id)
    ) {
      continue;
    }
    const comesBack =
      drawFor(state.seed, `thread:${thread.id}`, state.month) < thread.chance;
    state.threads.push({
      id: thread.id,
      month: state.month,
      due: comesBack
        ? monthAfter(state, `thread-wait:${thread.id}`, thread.after)
        : null,
      played: null,
    });
  }
}

/** Adds any hidden risk this flag builds up, once in a run. */
export function startRisks(
  state: State,
  content: Content,
  flags: readonly string[],
): void {
  for (const risk of content.risks) {
    if (
      !flags.includes(risk.addedBy) ||
      state.truth.risks.some((r) => r.id === risk.id)
    ) {
      continue;
    }
    state.truth.risks.push({
      id: risk.id,
      month: state.month,
      due: monthAfter(state, `risk-wait:${risk.id}`, risk.after),
      cameOut: null,
    });
  }
}
