import { gameContent, panelText } from "../content";
import { Modal } from "./Modal";

/**
 * A ride in the lift, from one floor to another, by their jobs. It waits until
 * the news that caused it has been read, so it opens only once `riding` is set.
 */
export interface Ride {
  from: string;
  to: string;
  riding: boolean;
}

const rideKey = "failureship.ride";

/** A floor's number, counting from the bottom of the tower. */
function floorNumber(job: string): number {
  return gameContent.floors.findIndex((f) => f.job === job) + 1;
}

/** The ride the player had not finished, if any, so that a reload keeps it. */
export function readRide(): Ride | null {
  try {
    const saved = window.localStorage.getItem(rideKey);
    return saved === null ? null : (JSON.parse(saved) as Ride);
  } catch {
    return null;
  }
}

export function writeRide(ride: Ride | null): void {
  try {
    if (ride === null) window.localStorage.removeItem(rideKey);
    else window.localStorage.setItem(rideKey, JSON.stringify(ride));
  } catch {
    // With storage refused, a reload simply skips the ride.
  }
}

export function LiftRide({
  ride,
  onStepOut,
}: {
  ride: Ride;
  onStepOut: () => void;
}) {
  return (
    <Modal
      testId="lift-ride"
      title={panelText.liftRideTitle}
      onClose={onStepOut}
    >
      <p className="lift-ride" data-testid="lift-ride-floors">
        {panelText.liftRideBody
          .replace("{from}", String(floorNumber(ride.from)))
          .replace("{to}", String(floorNumber(ride.to)))}
      </p>
      <button
        type="button"
        className="primary"
        data-testid="lift-step-out"
        onClick={onStepOut}
      >
        {panelText.liftRideStepOut}
      </button>
    </Modal>
  );
}
