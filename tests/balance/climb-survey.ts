import { gameContent } from "../../src/content";
import { withoutSeatEvents } from "../engine/fixture";
import {
  CLEAN,
  FOR_REAL,
  FOR_SHOW,
  FOR_THE_SEAT,
  GET_RID,
  HONEST,
  REPORT,
  climb,
} from "../engine/real-runs";

const content = withoutSeatEvents(gameContent);
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
/** The deals in two halves, each played in its own test, so that none runs long. */
export const HALVES = [SEEDS.slice(0, 100), SEEDS.slice(100)];

/**
 * Of 200 deals, which this player wins, and by which route up, seat by seat:
 * how each seat fell vacant, or `ousted` where the player got rid of its
 * holder. Without the Company Events that open seats, the routes are only
 * what the player did. Each half is played once, and `whole` plays any half
 * not yet played.
 */
function survey(once: string, always: readonly string[]) {
  const played = new Map<number, { seed: number; route: string | null }[]>();
  const half = (h: number) => {
    const known = played.get(h);
    if (known) return known;
    const runs = (HALVES[h] ?? []).map((seed) => {
      const { views, truth } = climb(seed, once, always, content);
      const end = views.at(-1)?.step;
      if (end?.kind !== "results" || !end.ending.won)
        return { seed, route: null };
      const route = truth.vacancies
        .filter((v) => v.decided?.winner === "you")
        .map((v) => (v.ousted ? "ousted" : v.way))
        .join(" > ");
      return { seed, route };
    });
    played.set(h, runs);
    return runs;
  };
  const whole = () => {
    const routes = new Map<string, number[]>();
    for (const { seed, route } of HALVES.flatMap((_, h) => half(h))) {
      if (route !== null)
        routes.set(route, [...(routes.get(route) ?? []), seed]);
    }
    const wins = [...routes.values()].flat().length;
    return { wins, routes };
  };
  return { half, whole };
}

// A seat falls vacant in a month at the earliest, so the climb is a race
// against eighteen months, which a player who knows the game wins on some
// deals and not others. Doing the Plans and getting rid of bosses are
// different routes up, each the player's own doing, on every floor. Without
// more bad behaviour than that, few reach the top. Each way of playing is its
// own file, so that workers share them.

/** Fakes Floor 1's Plan, then does each Plan for real. */
export const planner = survey(CLEAN, [...FOR_REAL, ...FOR_THE_SEAT]);

/** Does every Plan for real. */
export const honest = survey(HONEST, [...FOR_REAL, ...FOR_THE_SEAT]);

/** Fakes Floor 1's Plan, then gets rid of each boss above it. */
export const ridder = survey(CLEAN, [...GET_RID, ...FOR_THE_SEAT]);

/** Gets rid of every boss, starting with the Speak Up line on Floor 1. */
export const engineer = survey(`take-the-blame,${REPORT}`, [
  ...GET_RID,
  ...FOR_THE_SEAT,
]);

/** Fakes every Plan. */
export const forShow = survey(CLEAN, [...FOR_SHOW, ...FOR_THE_SEAT]);
