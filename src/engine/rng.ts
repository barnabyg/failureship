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

export function pick<T>(
  state: number,
  items: readonly T[],
): { item: T; next: number } {
  const { value, next } = draw(state);
  const item = items[Math.floor(value * items.length)];
  if (item === undefined) throw new Error("Cannot pick from an empty list.");
  return { item, next };
}
