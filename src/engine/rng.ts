/** A seeded random number generator whose whole state is one integer. */
export interface Draw {
  value: number;
  next: number;
}

/** mulberry32: returns a value in [0, 1) and the state for the next draw. */
export function draw(state: number): Draw {
  const next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, next };
}

/**
 * A draw of its own for one seeded question, such as whether this month's input
 * is late. The answer stays the same whatever the player has done so far.
 */
export function drawFor(seed: number, question: string, month: number): number {
  let hash = 0x811c9dc5 ^ seed;
  for (const char of `${question}:${String(month)}`) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01000193);
  }
  return draw(hash).value;
}

/** Fisher-Yates, drawing from the generator. */
export function shuffle<T>(
  state: number,
  items: readonly T[],
): { items: T[]; next: number } {
  const shuffled = [...items];
  let next = state;
  for (let i = shuffled.length - 1; i > 0; i--) {
    const drawn = draw(next);
    next = drawn.next;
    const j = Math.floor(drawn.value * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j] as T, shuffled[i] as T];
  }
  return { items: shuffled, next };
}

/** Picks an item with probability in proportion to its weight. */
export function pickWeighted<T>(
  state: number,
  items: readonly T[],
  weightOf: (item: T) => number,
): { item: T; next: number } {
  const { value, next } = draw(state);
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let left = value * total;
  for (const item of items) {
    left -= weightOf(item);
    if (left < 0) return { item, next };
  }
  throw new Error("Cannot pick from nothing with any weight.");
}

export function pick<T>(
  state: number,
  items: readonly T[],
): { item: T; next: number } {
  const { value, next } = draw(state);
  const item = items[Math.floor(value * items.length)];
  if (item === undefined) throw new Error("Cannot pick from an empty list.");
  return { item, next };
}
