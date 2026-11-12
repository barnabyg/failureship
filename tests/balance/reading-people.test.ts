import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import type { PlayerView, Run } from "../../src/engine";
import { plainChoice } from "../../src/ui/later-month";
import {
  guessesWhomToAsk,
  knowsThePowerMap,
  readsTheRoom,
} from "../engine/players";
import { FAKED, FOR_SHOW, climb, type Otherwise } from "../engine/real-runs";

/**
 * Whom a climber asks about each open seat, played through the real game on
 * the same deals as tests/balance/ways-of-playing.test.ts, whose numbers
 * docs/playtest.md gives beside these.
 */

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

/** Takes the blame in month 2, fakes the Plan and claims its credit. */
const CLIMBER = `take-the-blame,${FAKED},claim-the-credit`;
/** Then fakes every Plan above, and claims each one's credit. */
const FOR_SHOW_AND_CREDIT = [
  ...FOR_SHOW,
  "claim-it-team-lead",
  "claim-it-middle-manager",
];

/** Seats won, of those the player stood for, and runs won, by how they pick whom to ask. */
function asking(
  pick: (seed: number) => {
    otherwise: Otherwise;
    watch?: (view: PlayerView, run: Run) => void;
  },
) {
  let won = 0;
  let stood = 0;
  let runsWon = 0;
  for (const seed of SEEDS) {
    const { truth, views } = climb(
      seed,
      CLIMBER,
      FOR_SHOW_AND_CREDIT,
      gameContent,
      pick(seed),
    );
    const decided = truth.vacancies.filter((v) =>
      v.decided?.candidates.some((c) => c.who === "you"),
    );
    stood += decided.length;
    won += decided.filter((v) => v.decided?.winner === "you").length;
    const end = views.at(-1)?.step;
    if (end?.kind === "results" && end.ending.won) runsWon += 1;
  }
  return { seats: won / stood, runsWon };
}

// Whoever really holds influence over a seat decides it, and a word with
// them, or with someone they listen to, counts. So the climb still pays a
// player who reads people. Of these 100 deals, a climber who fakes the Plans
// and claims their credit wins 62.0% of seats knowing the Power Map, 60.8%
// reading the room, 57.9% on a guess, and 46.6% leaving it to the process;
// and 15, 14, 12 and 7 runs. The deals are fixed, so the narrow lead of
// knowing over reading cannot flake.
describe("reading people on the way up", { timeout: 60_000 }, () => {
  const once = <T>(play: () => T) => {
    let played: { value: T } | undefined;
    return () => (played ??= { value: play() }).value;
  };
  const leaving = once(() => asking(() => ({ otherwise: plainChoice })));
  const guessing = once(() =>
    asking((seed) => ({ otherwise: guessesWhomToAsk(seed) })),
  );
  const reading = once(() => asking(() => readsTheRoom()));
  const knowing = once(() => asking(() => ({ otherwise: knowsThePowerMap })));

  // Each way of picking is played once, in its own test, so that none runs
  // long. The tests after compare them, and play any not yet played.
  it.each([
    ["leaving it to the process", leaving],
    ["a guess", guessing],
    ["reading the room", reading],
    ["knowing the Power Map", knowing],
  ])("plays a hundred deals, asking by %s", (_, picking) => {
    expect(picking().seats).toBeGreaterThan(0);
  });

  it("wins more seats for a careful reader of the room than for a guess", () => {
    expect(reading().seats).toBeGreaterThan(guessing().seats);
    expect(reading().runsWon).toBeGreaterThan(guessing().runsWon);
  });

  it("wins more seats for a guess than for leaving it to the process", () => {
    expect(guessing().seats).toBeGreaterThan(leaving().seats);
  });

  it("wins no fewer seats for knowing the Power Map than for reading the room", () => {
    expect(knowing().seats).toBeGreaterThanOrEqual(reading().seats);
  });
});
