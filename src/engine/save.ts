import type { Content } from "./content";
import type { State } from "./state";

/**
 * Raise this whenever what a save holds changes its meaning. A save of another
 * version is not migrated: the player is offered a new run instead.
 */
export const SAVE_VERSION = 1;

/** Thrown when a save is old, broken or does not fit the current content. */
export class UnusableSaveError extends Error {
  override name = "UnusableSaveError";
}

/** Changes whenever the content does, since a run is only sure on what dealt it. */
function fingerprintOf(content: Content): string {
  let hash = 0x811c9dc5;
  for (const unit of JSON.stringify(content)) {
    hash = Math.imul(hash ^ (unit.codePointAt(0) ?? 0), 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export function writeSave(state: State, content: Content): string {
  return JSON.stringify({
    version: SAVE_VERSION,
    content: fingerprintOf(content),
    state,
  });
}

function sameKeys(a: object, b: object): boolean {
  const keys = Object.keys(a);
  const others = new Set(Object.keys(b));
  return keys.length === others.size && keys.every((key) => others.has(key));
}

/**
 * Reads a save back, against a new run's state on the same content. Having the
 * same fields catches state added to the engine without raising the version.
 */
export function readSave(text: string, content: Content, fresh: State): State {
  let saved: { version?: unknown; content?: unknown; state?: State } | null;
  try {
    saved = JSON.parse(text) as typeof saved;
  } catch {
    throw new UnusableSaveError("A save is not readable.");
  }
  if (saved?.version !== SAVE_VERSION) {
    throw new UnusableSaveError("A save is of another version.");
  }
  if (saved.content !== fingerprintOf(content)) {
    throw new UnusableSaveError("A save does not fit the content.");
  }
  const { state } = saved;
  if (
    typeof state !== "object" ||
    !sameKeys(state, fresh) ||
    typeof state.truth !== "object" ||
    !sameKeys(state.truth, fresh.truth)
  ) {
    throw new UnusableSaveError("A save does not fit this engine.");
  }
  return state;
}
