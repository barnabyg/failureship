/**
 * The separate read of a run's true state, kept apart from the player view.
 * Tests use it to set up and check outcomes, and the results screen will use it
 * once a run has ended. Lint stops the interface from importing it.
 */
export { hiddenTruthOf as readHiddenTruth } from "./run";
export type { HiddenTruth } from "./run";
