import { dueIdOf, type Content } from "./content";
import { influencerOf, leaveMap } from "./deal";
import { dropPlans } from "./grand-plans";
import { bossOf, isGone, wouldEmptyAPlace } from "./places";
import { kindOf, matches, moodOfCharacter, shiftBelief } from "./reads";
import { remember } from "./reputation";
import { drawFor } from "./rng";
import { calledBy, sayPeople } from "./say";
import type { State } from "./state";
import { openSeat } from "./vacancies";

/**
 * Whether someone can go: they are still here, and going would not leave a
 * place above the player empty.
 */
export function canGo(state: State, content: Content, id: string): boolean {
  return !isGone(state, id) && !wouldEmptyAPlace(state, content, id);
}

/**
 * Someone leaves the company, or is fired, for the rest of the run. The player's
 * boss leaves their seat open. Whoever has gone is off the Power Map and out of
 * every commitment: their open Promises and Deals lapse, and any Grand Plan of
 * theirs ends with them. Nobody is ever in a place above the player once gone.
 */
export function depart(
  state: State,
  content: Content,
  id: string,
  how: "left" | "fired",
): void {
  if (!canGo(state, content, id)) return;
  // Opened first, while whoever held influence over them is still known.
  if (id === bossOf(state, content)) openSeat(state, content, id, how);
  state.gone.push({ character: id, month: state.month, how });
  state.truth.powerMap = leaveMap(state.truth.powerMap, id);
  const lapsed: string[] = [];
  for (const made of state.promises) {
    if (made.status === "open" && made.to === id) {
      made.status = "lapsed";
      lapsed.push(dueIdOf(made.id));
    }
  }
  for (const made of state.deals) {
    const item = content.deals?.items.find((d) => d.id === made.id);
    if (made.status === "open" && item?.with === id) {
      made.status = "lapsed";
      lapsed.push(dueIdOf(made.id));
    }
  }
  state.unanswered = state.unanswered.filter((n) => !lapsed.includes(n));
  dropPlans(state, id);
}

/**
 * The player tries to get rid of their boss, in one of the ways written. It is
 * up to whoever holds influence over the boss on the Power Map, at a seeded
 * chance by their kind and how they stand with the player. Nobody above the
 * boss, or a way whose `when` does not hold, and nobody acts on it. If it works, the boss is fired and their seat is
 * open; if not, the boss stays, and remembers.
 */
export function oust(state: State, content: Content, way: string): void {
  const written = content.vacancies?.ousting;
  const chances = written?.ways[way];
  if (!written || !chances) return;
  const boss = bossOf(state, content);
  const above = influencerOf(state.truth.powerMap, boss);
  const chance =
    above === undefined || !matches(state, content, chances.when)
      ? 0
      : chances.chance[kindOf(state, above)] +
        written.mood[moodOfCharacter(state, content, above)];
  const works =
    canGo(state, content, boss) &&
    drawFor(state.seed, `oust:${way}`, state.month) < chance;
  // What the boss is called is read before they go.
  const words = { "{holder}": calledBy(state, content, boss) };
  const told = works ? written.gone : written.survived;
  // Told before the seat it opens.
  state.noticesDue.push({
    title: sayPeople(told.title, words),
    body: sayPeople(told.body, words),
  });
  if (works) {
    depart(state, content, boss, "fired");
    return;
  }
  const { about, text, belief } = written.remembered;
  shiftBelief(state, boss, belief);
  remember(state, content, { character: boss, about, text, tone: "bad" });
}
