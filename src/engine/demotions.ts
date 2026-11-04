import type { Content } from "./content";
import { YOU } from "./deal";
import { managerOf } from "./places";
import { teamOf } from "./reads";
import { calledBy, sayPeople } from "./say";
import type { State } from "./state";

/**
 * The seat the player holds, if they won one and their job is still the one it
 * gave them, and how it was decided.
 */
function seatHeld(state: State, content: Content) {
  const seat = content.vacancies?.seats.find((s) => s.job === state.job);
  const decided = state.vacancies.findLast(
    (v) => v.seat === seat?.id && v.decided?.winner === YOU,
  )?.decided;
  return seat && decided ? { seat, decided } : undefined;
}

/**
 * As a month closes in which the player made a big mistake and was not fired,
 * a player in a seat they won loses it, whoever decided it, and goes back to
 * the seat's floor and job. Whoever of their team came closest to the seat
 * when it was decided takes it, with the title the player's predecessor held
 * in it, and the player and the rest of the team answer to them. With nobody
 * left on the team, the seat stays empty, and the player answers to whoever
 * they answered to. On the floor below, its own months pick up where the
 * player left them.
 */
export function demoteForMistakes(state: State, content: Content): void {
  const words = content.mistakes?.demoted;
  const held = seatHeld(state, content);
  if (
    !words ||
    !held ||
    state.firedIn !== null ||
    !state.mistakes.some((m) => m.month === state.month)
  ) {
    return;
  }
  const { seat, decided } = held;
  const above = managerOf(state, content, YOU);
  const strength = (id: string) =>
    decided.candidates.find((c) => c.who === id)?.strength ?? -Infinity;
  // Sorting is stable, so equals stay in the order written.
  const team = teamOf(state, content, YOU).sort(
    (a, b) => strength(b) - strength(a),
  );
  const [successor] = team;
  const boss = successor ?? above;
  // What the new boss is called is read before anyone moves.
  const called = boss === undefined ? "" : calledBy(state, content, boss);
  if (successor !== undefined) {
    if (above !== undefined) state.reportsTo[successor] = above;
    state.titles[successor] = decided.held;
    for (const id of [YOU, ...team.slice(1)]) state.reportsTo[id] = successor;
  }
  state.job = seat.floor;
  state.demotions.push({ month: state.month, job: seat.floor });
  state.noticesDue.push({
    title: words.title,
    body: sayPeople(words.body, { "{boss}": called }),
  });
}
