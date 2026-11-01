import type { Content } from "./content";
import { drawFor } from "./rng";
import type { State } from "./state";

/**
 * Starts any Thread this flag begins, once in a run. Whether it ever comes back,
 * and when, are named draws, so that they leave the shared random state alone.
 */
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
    const { month, seed } = state;
    const { min, max } = thread.after;
    const comesBack =
      drawFor(seed, `thread:${thread.id}`, month) < thread.chance;
    const wait = drawFor(seed, `thread-wait:${thread.id}`, month);
    state.threads.push({
      id: thread.id,
      month,
      due: comesBack ? month + min + Math.floor(wait * (max - min + 1)) : null,
      played: null,
    });
  }
}
