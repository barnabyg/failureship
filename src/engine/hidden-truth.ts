/**
 * The separate read of a run's true state, kept apart from the player view.
 * Tests use it to set up and check outcomes. The results screen does not: the
 * engine adds the reveal to the player view once a run has ended. Lint stops the
 * interface from importing this.
 */
export { hiddenTruthOf as readHiddenTruth } from "./run";
export type { HiddenTruth } from "./run";
