import type { Content, Seat } from "./content";
import { YOU } from "./deal";
import { floorOf } from "./floors";
import { planCompleted } from "./grand-plans";
import { matches, personOf } from "./reads";
import { sayMonth, sayPeople } from "./say";
import type { State, Vacancy } from "./state";
import type { StepView } from "./view";

type Win = NonNullable<Seat["win"]>;
type Written = NonNullable<Content["vacancies"]>;

/** The seat that is the way out of the top floor, and what winning it says. The checks allow one. */
function winOf(content: Content): Win | undefined {
  return content.vacancies?.seats.find((s) => s.win)?.win;
}

/** What winning says, once the player has won. */
function wonWith(state: State, content: Content): Win | undefined {
  return state.wonIn === null ? undefined : winOf(content);
}

/**
 * The comic stand-in for winning, told once, after the seat that won it: the
 * first variant for how the player got there, or else the stand-in as written.
 */
export function toWinView(
  state: State,
  content: Content,
): Extract<StepView, { kind: "win" }> {
  const win = wonWith(state, content);
  if (!win) throw new Error("The run has not been won.");
  const variant = win.variants.find((v) => matches(state, content, v.when));
  return {
    kind: "win",
    title: variant?.title ?? win.title,
    lines: variant?.lines ?? win.lines,
  };
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
  const ending = wonWith(state, content)?.ending;
  return ending === undefined ? undefined : sayMonth(ending, state.wonIn);
}

/**
 * The words for a seat the player won: by getting rid of its holder, by how a
 * Grand Plan was done, or by the way it fell vacant.
 */
function routeOf(
  state: State,
  content: Content,
  written: Written,
  { holder, way, ousted }: Vacancy,
): string {
  if (ousted || way === "fired") return written.route.ousted;
  if (way !== "plan") return written.route[way];
  const how = planCompleted(state, content, holder)?.how;
  return written.route.plan[how === "reality" ? "reality" : "appearance"];
}

/**
 * How the player got where they did: each seat they won, with what it took
 * them to, and each time a big mistake took them back down, in the order they
 * happened.
 */
export function routeInResults(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }>["route"] {
  const written = content.vacancies;
  if (!written) return [];
  const say = (line: string, month: number, job: string, holder = "") =>
    sayMonth(sayPeople(line, { "{job}": job, "{holder}": holder }), month);
  const ups = state.vacancies.flatMap((vacancy) => {
    const { seat: id, holder, decided } = vacancy;
    const seat = written.seats.find((s) => s.id === id);
    if (decided?.winner !== YOU || !seat) return [];
    const job =
      seat.job === undefined
        ? (seat.win?.reached ?? "")
        : floorOf(content, seat.job).title;
    const { name } = personOf(state, content, holder);
    const line = routeOf(state, content, written, vacancy);
    return [
      { month: decided.month, text: say(line, decided.month, job, name) },
    ];
  });
  const downs = state.demotions.map(({ month, job }) => ({
    month,
    text: say(written.route.demoted, month, floorOf(content, job).title),
  }));
  // A seat and a demotion in one month: the demotion goes first, as it does.
  return [...downs, ...ups].sort((a, b) => a.month - b.month);
}
