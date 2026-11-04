import type { Content } from "./content";
import { lowerOnMap, raiseOnMap } from "./deal";
import { emptiesAPlace, isGone, managerHere, managerOf, whoIs } from "./places";
import type { State } from "./state";

/**
 * Who moves on the Org Chart, and who rises or falls on the Power Map. Each can
 * name a place above the player, meaning whoever is in it as it happens.
 */
export interface Reshuffle {
  reports: readonly { character: string; to: string }[];
  rises: readonly string[];
  falls: readonly string[];
}

/**
 * Moves people on the charts, the player and their bosses included. A move that
 * would make a loop, or leave the player with no boss's boss, does not happen.
 */
export function reshuffleCharts(
  state: State,
  content: Content,
  reshuffle: Reshuffle,
): void {
  const who = (written: string) => whoIs(state, content, written);
  const reports = reshuffle.reports.map((r) => ({
    character: who(r.character),
    to: who(r.to),
  }));
  const here = (id: string) => !isGone(state, id);
  for (const { character, to } of reports.filter(
    (r) => here(r.character) && here(r.to),
  )) {
    const answersTo = (id: string | undefined): boolean =>
      id !== undefined &&
      (id === character || answersTo(managerOf(state, content, id)));
    if (answersTo(to)) continue;
    // Nor does one that would leave a place above the player with nobody in it.
    const moved = { ...state.reportsTo, [character]: to };
    const after = { ...state, reportsTo: moved };
    const empties = emptiesAPlace(state, content, (at) =>
      managerHere(after, content, at),
    );
    if (!empties) state.reportsTo = moved;
  }
  const { truth } = state;
  for (const id of reshuffle.rises.map(who).filter(here)) {
    truth.powerMap = raiseOnMap(truth.powerMap, id);
  }
  for (const id of reshuffle.falls.map(who).filter(here)) {
    truth.powerMap = lowerOnMap(truth.powerMap, id);
  }
}
