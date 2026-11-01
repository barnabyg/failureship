/** The generator's state is 32 bits, so a larger seed would repeat a smaller one. */
const LARGEST_SEED = 2 ** 32 - 1;

/** Reads a seed written by a person, or null if it cannot be used. */
export function parseSeed(written: string): number | null {
  const trimmed = written.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const seed = Number(trimmed);
  return seed <= LARGEST_SEED ? seed : null;
}
