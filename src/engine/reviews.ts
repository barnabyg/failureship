import type { Content } from "./content";
import { openScene } from "./scenes";
import type { State, Step, World } from "./state";

/**
 * The quarter of the run that this month closes, if it closes one. Quarters go
 * by the run's month, not the month on a floor, so they come round on any floor.
 */
function quarterClosing(state: State, content: Content): number | null {
  const { monthsPerQuarter } = content.balance;
  if (monthsPerQuarter === undefined || state.month % monthsPerQuarter !== 0) {
    return null;
  }
  return state.month / monthsPerQuarter;
}

/**
 * Opens the quarter's review, once, in the month that closes it. Nobody can stay
 * away, and it takes none of the player's actions. The checks make sure each
 * quarter of the run has one.
 */
export function holdReview(state: State, world: World): Step | null {
  if (state.reviewed) return null;
  const quarter = quarterClosing(state, world.content);
  const review = world.content.scenes.find(
    (s) => quarter !== null && s.quarter === quarter,
  );
  if (!review) return null;
  state.reviewed = true;
  return openScene(state, world, review.id);
}
