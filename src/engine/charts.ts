import type { Content } from "./content";
import { lowerOnMap, raiseOnMap } from "./deal";
import type { State } from "./state";

/** Who moves on the Org Chart, and who rises or falls on the Power Map. */
export interface Reshuffle {
  reports: readonly { character: string; to: string }[];
  rises: readonly string[];
  falls: readonly string[];
}

/** Who someone answers to on the Org Chart now. */
export function managerOf(
  state: State,
  content: Content,
  id: string,
): string | undefined {
  return (
    state.reportsTo[id] ??
    content.characters.find((c) => c.id === id)?.reportsTo
  );
}

/** Moves people on the charts. A move that would make a loop does not happen. */
export function reshuffleCharts(
  state: State,
  content: Content,
  { reports, rises, falls }: Reshuffle,
): void {
  for (const { character, to } of reports) {
    const answersTo = (id: string | undefined): boolean =>
      id !== undefined &&
      (id === character || answersTo(managerOf(state, content, id)));
    if (!answersTo(to)) state.reportsTo[character] = to;
  }
  const { truth } = state;
  for (const id of rises) truth.powerMap = raiseOnMap(truth.powerMap, id);
  for (const id of falls) truth.powerMap = lowerOnMap(truth.powerMap, id);
}
