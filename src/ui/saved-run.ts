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

const resultKey = "failureship.result-open";

/** Whether the last choice's result was still to be read, so a reload keeps it. */
export function readResultOpen(): boolean {
  try {
    return window.localStorage.getItem(resultKey) === "true";
  } catch {
    return false;
  }
}

export function writeResultOpen(open: boolean): void {
  try {
    if (open) window.localStorage.setItem(resultKey, "true");
    else window.localStorage.removeItem(resultKey);
  } catch {
    // With storage refused, a reload simply skips the result.
  }
}
