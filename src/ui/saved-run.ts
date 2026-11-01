const key = "failureship.run";

/** The saved run, if any. Storage can be refused, and the game still plays. */
export function readSavedRun(): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSavedRun(save: string): void {
  try {
    window.localStorage.setItem(key, save);
  } catch {
    // With storage refused or full, the run simply does not survive a reload.
  }
}
