import type { Content, Seat } from "./content";
import { YOU } from "./deal";
import { planCompleted } from "./grand-plans";
import { bossOf, managerOf } from "./places";
import { isGone, moodOfCharacter, personOf } from "./reads";
import { remember } from "./reputation";
import { competitionNow } from "./rivals";
import { drawFor } from "./rng";
import { calledBy, sayPeople } from "./say";
import { standingOnPaper } from "./standing";
import type { Candidate, State, Vacancy } from "./state";
import type { StepView } from "./view";

type Written = NonNullable<Content["vacancies"]>;
type Reason = keyof Written["reasons"];
type Decided = NonNullable<Vacancy["decided"]>;

/** Whether someone's seat is open, so that they are on their way up. */
export function isMovingUp(state: State, id: string): boolean {
  return state.vacancies.some((v) => v.holder === id && v.decided === null);
}

/**
 * As the official story closes a month: any seat due to be decided now is, and
 * the seat of a boss who completed their Grand Plan this month, and counted it
 * done, falls vacant from the next. That is the first promotion. Nothing opens
 * that the run would end before deciding.
 */
export function fillVacancies(state: State, content: Content): void {
  const written = content.vacancies;
  if (!written) return;
  for (const vacancy of state.vacancies) {
    if (vacancy.decided === null && vacancy.decides === state.month) {
      decide(state, content, written, vacancy);
    }
  }
  const boss = bossOf(state, content);
  const seat = written.seats.find((s) => s.floor === state.job);
  const done = planCompleted(state, content, boss);
  const decides = state.month + (seat?.openFor ?? 0);
  if (
    !seat ||
    !done?.counted ||
    done.month !== state.month ||
    isGone(state, boss) ||
    isMovingUp(state, boss) ||
    decides > content.balance.monthsPerRun
  ) {
    return;
  }
  state.vacancies.push({
    seat: seat.id,
    holder: boss,
    opened: state.month + 1,
    decides,
    decided: null,
  });
  state.noticesDue.push({
    title: seat.opened.title,
    body: sayPeople(seat.opened.body, {
      "{holder}": calledBy(state, content, boss),
    }).replaceAll("{month}", String(decides)),
  });
}

/** Whether `who` is above `over` on the Power Map, however far up. */
function isAbove(state: State, who: string, over: string): boolean {
  const { influence } = state.truth.powerMap;
  const seen = new Set<string>();
  let above = influence.find((i) => i.over === over)?.who;
  while (above !== undefined && !seen.has(above)) {
    if (above === who) return true;
    seen.add(above);
    const next = above;
    above = influence.find((i) => i.over === next)?.who;
  }
  return false;
}

/**
 * What counts with whoever decides, for one candidate. For a Character: being
 * the one deciding, being owed a favour by them, being under them on the Power
 * Map, and working for it as a Rival. For the player: a favour they are owed,
 * and what has reached the one deciding of them. Nothing else counts: not the
 * Org Chart, not Official standing, not a Gauge.
 */
function weigh(
  state: State,
  content: Content,
  written: Written,
  decider: string,
  who: string,
  rivals: ReadonlySet<string>,
): Candidate {
  const { favours, influence } = state.truth.powerMap;
  const owes = (to: string) =>
    favours.some((f) => f.owes === decider && f.to === to);
  const reasons: Reason[] = [];
  if (who === YOU) {
    if (owes(YOU)) reasons.push("owedYou");
    reasons.push(moodOfCharacter(state, content, decider));
  } else {
    if (who === decider) reasons.push("self");
    if (owes(who)) reasons.push("owed");
    if (influence.some((i) => i.who === decider && i.over === who)) {
      reasons.push("protege");
    } else if (isAbove(state, decider, who)) {
      reasons.push("circle");
    }
    if (rivals.has(who)) reasons.push("rival");
  }
  const strength = reasons.reduce(
    (sum, r) => sum + written.reasons[r].strength,
    0,
  );
  return { who, reasons, strength };
}

/**
 * Whoever really holds influence over the seat on the Power Map decides it: the
 * one above its holder there, or the holder if nobody is. The candidates are the
 * player and whoever competes for it, and the strongest reasons win, with a
 * seeded draw among equals. The holder moves up, the winner takes the seat, and
 * whoever answered to the holder answers to them. Winning takes the player to
 * the seat's floor. Each Character passed over remembers.
 */
function decide(
  state: State,
  content: Content,
  written: Written,
  vacancy: Vacancy,
): void {
  const seat = written.seats.find((s) => s.id === vacancy.seat);
  if (!seat) return;
  const { holder } = vacancy;
  const decider =
    state.truth.powerMap.influence.find((i) => i.over === holder)?.who ??
    holder;
  const competition = competitionNow(state, content);
  const rivals = new Set(competition.rivals.map((r) => r.character));
  const others = competition.competing
    .filter((c) => c.for.includes(seat.competing) && c.character !== holder)
    .map((c) => c.character);
  const candidates = [YOU, ...others].map((who) =>
    weigh(state, content, written, decider, who, rivals),
  );
  const best = Math.max(...candidates.map((c) => c.strength));
  const top = candidates.filter((c) => c.strength === best);
  const drawn = drawFor(state.seed, `vacancy:${seat.id}`, state.month);
  const winner = top[Math.floor(drawn * top.length)]?.who ?? YOU;
  const paper = standingOnPaper(state, content);
  const decided: Decided = {
    month: state.month,
    decider,
    winner,
    close: top.length > 1,
    candidates,
    onPaper: paper?.band ?? "",
  };
  vacancy.decided = decided;
  // What everyone is called is read before anyone moves.
  const called = (id: string) =>
    id === YOU ? "you" : calledBy(state, content, id);
  const words = { "{winner}": called(winner), "{holder}": called(holder) };
  const inFact = explain(written, decided, called);
  moveUp(state, content, seat, holder, winner);
  const { about, forYou, forSomeoneElse } = written.passedOver;
  const kept = winner === YOU ? forYou : forSomeoneElse;
  for (const { who } of candidates) {
    if (who === YOU || who === winner) continue;
    remember(state, content, {
      character: who,
      about,
      text: sayPeople(kept.text, words),
      tone: kept.tone,
    });
  }
  const told = winner === YOU ? seat.won : seat.lost;
  state.noticesDue.push({
    title: told.title,
    body: sayPeople(told.body, words),
    decided: {
      onPaper: paper && {
        label: paper.label,
        at: paper.at,
        band: paper.band,
        text: paper.onPaper,
      },
      inFact,
    },
  });
}

/** The holder moves up, and the winner takes their place on the Org Chart. */
function moveUp(
  state: State,
  content: Content,
  seat: Seat,
  holder: string,
  winner: string,
): void {
  const above = managerOf(state, content, holder) ?? seat.movesUp.reportsTo;
  const written = content.characters.find((c) => c.id === holder);
  const held = state.titles[holder] ?? {
    title: written?.title ?? "",
    called: written?.called ?? written?.name ?? holder,
  };
  const team = [
    YOU,
    ...content.characters
      .map((c) => c.id)
      .filter(
        (id) => !isGone(state, id) && managerOf(state, content, id) === holder,
      ),
  ];
  state.reportsTo[holder] = seat.movesUp.reportsTo;
  state.titles[holder] = {
    title: seat.movesUp.title,
    called: seat.movesUp.called,
  };
  state.reportsTo[winner] = above;
  if (winner === YOU) state.job = seat.job;
  else state.titles[winner] = held;
  for (const id of team.filter((t) => t !== winner)) {
    state.reportsTo[id] = winner;
  }
}

/** Who really decided, and why, as said beside Official standing. */
function explain(
  written: Written,
  decided: Decided,
  called: (id: string) => string,
): string {
  const whyOf = (who: string) => {
    const candidate = decided.candidates.find((c) => c.who === who);
    const reasons: Readonly<Record<string, Written["reasons"][Reason]>> =
      written.reasons;
    const why = (candidate?.reasons ?? [])
      .flatMap((r) => reasons[r] ?? [])
      .filter((r) => r.strength !== 0)
      .map((r) => r.why);
    // A draw among equals, or nothing written for it, went unminuted.
    const unminuted =
      why.length === 0 || (decided.close && who === decided.winner);
    return sayPeople((unminuted ? [...why, written.close] : why).join(" "), {
      "{decider}": called(decided.decider),
      "{who}": called(who),
    });
  };
  const inFact = sayPeople(written.inFact, {
    "{decider}": called(decided.decider),
    "{why}": whyOf(decided.winner),
  });
  if (decided.winner === YOU) return inFact;
  return `${inFact} ${sayPeople(written.asForYou, { "{why}": whyOf(YOU) })}`;
}

/** Each vacancy decided: whose seat it was, who had it, on paper and in fact. */
export function vacanciesInResults(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }>["vacancies"] {
  const written = content.vacancies;
  if (!written) return [];
  const nameOf = (id: string) =>
    id === YOU ? "you" : personOf(state, content, id).name;
  return state.vacancies.flatMap(({ holder, decided }) => {
    if (!decided) return [];
    return [
      {
        month: decided.month,
        text: sayPeople(written.results, {
          "{holder}": nameOf(holder),
          "{winner}": nameOf(decided.winner),
        }).replaceAll("{month}", String(decided.month)),
        onPaper: decided.onPaper,
        inFact: explain(written, decided, nameOf),
      },
    ];
  });
}
