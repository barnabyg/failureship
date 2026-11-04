import type { Content, Seat } from "./content";
import { YOU } from "./deal";
import { floorOf } from "./floors";
import { personOf } from "./reads";
import { sayPeople } from "./say";
import type { State } from "./state";
import type { StepView } from "./view";

type Win = NonNullable<Seat["win"]>;

/** The seat that is the way out of the top floor, and what winning it says. */
function winOf(content: Content): Win | undefined {
  return content.vacancies?.seats.find((s) => s.win)?.win;
}

/** What winning says, once the player has won. */
function wonWith(state: State, content: Content): Win | undefined {
  return state.wonIn === null ? undefined : winOf(content);
}

/** The comic stand-in for winning, told once, after the seat that won it. */
export function toWinView(
  state: State,
  content: Content,
): Extract<StepView, { kind: "win" }> {
  const win = wonWith(state, content);
  if (!win) throw new Error("The run has not been won.");
  return { kind: "win", title: win.title, lines: win.lines };
}

/** The results screen's heading and introduction, if the run was won. */
export function wonResults(
  state: State,
  content: Content,
): { title: string; intro: string } | undefined {
  return wonWith(state, content)?.results;
}

/** How the results screen says a won run ended, if it was won. */
export function wonEnding(state: State, content: Content): string | undefined {
  return wonWith(state, content)?.ending.replaceAll(
    "{month}",
    String(state.wonIn),
  );
}

/**
 * How the player got where they did: each seat they won, by how it fell
 * vacant, with what it took them to, and each time a big mistake took them
 * back down, in the order they happened.
 */
export function routeInResults(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }>["route"] {
  const written = content.vacancies;
  if (!written) return [];
  const say = (line: string, month: number, job: string, holder = "") =>
    sayPeople(line, { "{job}": job, "{holder}": holder }).replaceAll(
      "{month}",
      String(month),
    );
  const ups = state.vacancies.flatMap(({ seat: id, holder, way, decided }) => {
    const seat = written.seats.find((s) => s.id === id);
    if (decided?.winner !== YOU || !seat) return [];
    const job =
      seat.job === undefined
        ? (seat.win?.reached ?? "")
        : floorOf(content, seat.job).title;
    const { name } = personOf(state, content, holder);
    return [
      {
        month: decided.month,
        text: say(written.route[way], decided.month, job, name),
      },
    ];
  });
  const downs = state.demotions.map(({ month, job }) => ({
    month,
    text: say(written.route.demoted, month, floorOf(content, job).title),
  }));
  // A seat and a demotion in one month: the demotion goes first, as it does.
  return [...downs, ...ups].sort((a, b) => a.month - b.month);
}
