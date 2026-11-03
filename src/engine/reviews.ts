import type { Content } from "./content";
import { openScene } from "./scenes";
import type { State, Step, World } from "./state";

/**
 * The quarter of the run that this month closes, if it closes one. Quarters go
 * by the run's month, not the month on a floor, so they come round on any floor.
 */
export function quarterClosing(
  state: Pick<State, "month">,
  content: Content,
): number | null {
  const every = content.balance.monthsPerQuarter;
  if (every === undefined || state.month % every !== 0) return null;
  return state.month / every;
}

/** The review written for a quarter. The checks make sure each quarter of the run has one. */
export function reviewOf(content: Content, quarter: number) {
  return content.scenes.find((s) => s.quarter === quarter);
}

/**
 * Opens the quarter's review, once, in the month that closes it. Nobody can stay
 * away, and it takes none of the player's actions.
 */
export function holdReview(state: State, world: World): Step | null {
  if (state.reviewed) return null;
  const quarter = quarterClosing(state, world.content);
  const review =
    quarter === null ? undefined : reviewOf(world.content, quarter);
  if (!review) return null;
  state.reviewed = true;
  return openScene(state, world, review.id);
}
