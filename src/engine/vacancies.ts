import type { Content, Kind, Seat, SeatWay, VacancyReason } from "./content";
import { hasSway, influencerOf, isUnder, YOU } from "./deal";
import { planCompleted } from "./grand-plans";
import { bossOf, isGone, managerHere, whoIs } from "./places";
import {
  kindOf,
  moodOfCharacter,
  personOf,
  seatPending,
  shiftBelief,
  teamOf,
  titleHeld,
} from "./reads";
import { remember } from "./reputation";
import { competitionNow } from "./rivals";
import { drawFor } from "./rng";
import { calledBy, sayPeople } from "./say";
import { standingOnPaper } from "./standing";
import type { Candidate, State, Vacancy } from "./state";
import type { StepView } from "./view";

type Written = NonNullable<Content["vacancies"]>;
type Decided = NonNullable<Vacancy["decided"]>;
type SeatAct = NonNullable<Content["moves"][number]["seat"]>;

/** What whoever decides keeps of what was done for the seat. */
const ABOUT_THE_SEAT = "the-seat";

/**
 * As the official story closes a month: any seat due to be decided now is, and
 * the seat of a boss who completed their Grand Plan this month, and counted it
 * done, falls vacant from the next. That is the first promotion.
 */
export function fillVacancies(state: State, content: Content): void {
  const written = content.vacancies;
  if (!written) return;
  for (const vacancy of [...state.vacancies]) {
    if (vacancy.decided === null && vacancy.decides === state.month) {
      decide(state, content, written, vacancy);
    }
  }
  const boss = bossOf(state, content);
  const done = planCompleted(state, content, boss);
  if (done?.counted && done.month === state.month) {
    openSeat(state, content, boss, "plan");
  }
}

/**
 * The player's boss's seat falls vacant, in one of the ways a seat can, and is
 * open from the next month for the seat's `openFor` months. Only the seat of the
 * player's floor opens, one at a time, and nothing opens that the run would end
 * before deciding. A boss who goes is told of before they have gone.
 */
export function openSeat(
  state: State,
  content: Content,
  holder: string,
  way: SeatWay,
): void {
  const seat = content.vacancies?.seats.find((s) => s.floor === state.job);
  const decides = state.month + (seat?.openFor ?? 0);
  if (
    !seat ||
    holder !== bossOf(state, content) ||
    isGone(state, holder) ||
    seatPending(state) ||
    decides > content.balance.monthsPerRun
  ) {
    return;
  }
  state.vacancies.push({
    seat: seat.id,
    holder,
    way,
    patron: influencerOf(state.truth.powerMap, holder) ?? null,
    opened: state.month + 1,
    decides,
    credit: null,
    calledIn: [],
    decided: null,
  });
  const opened = seat.opened[way];
  state.noticesDue.push({
    title: opened.title,
    body: sayPeople(opened.body, {
      "{holder}": calledBy(state, content, holder),
    }).replaceAll("{month}", String(decides)),
  });
}

/**
 * Whoever really holds influence over a seat: the one above its holder on the
 * Power Map, or for a holder who has gone, whoever was above them as they went,
 * or, if that person has gone too, whoever was above them in turn. With nobody
 * above, whoever is most influential of those still here.
 */
function deciderOf(state: State, vacancy: Vacancy): string {
  const map = state.truth.powerMap;
  const { holder, patron } = vacancy;
  if (!isGone(state, holder)) return influencerOf(map, holder) ?? holder;
  // Nobody gone is on the Power Map, so its most influential is here.
  const top = map.order[0];
  if (patron !== null) return patron;
  if (top === undefined) throw new Error("Nobody is left to decide.");
  return top;
}

function openVacancy(state: State): Vacancy | undefined {
  return state.vacancies.find(
    (v) => v.decided === null && v.opened <= state.month,
  );
}

/**
 * Something done for an open seat, by the player or by a Character's Move. It
 * counts only through what really decides it: what reaches whoever decides, the
 * favours owed between them and others, and who has the Plan's credit.
 */
export function actForSeat(
  state: State,
  content: Content,
  act: SeatAct,
  actor: string,
): void {
  const written = content.vacancies;
  const vacancy = openVacancy(state);
  if (!written || !vacancy) return;
  const map = state.truth.powerMap;
  const decider = deciderOf(state, vacancy);
  const keep = (
    kept: { text: string; belief: number },
    via: string | null,
  ): void => {
    shiftBelief(state, decider, kept.belief);
    remember(state, content, {
      character: decider,
      about: ABOUT_THE_SEAT,
      text: kept.text,
      via,
    });
  };
  if (act.approach !== undefined && actor === YOU) {
    const target = whoIs(state, content, act.approach);
    if (target === decider) keep(written.acts.approach.decider, null);
    else if (hasSway(map, target, decider)) {
      keep(written.acts.approach.sway, target);
    }
  }
  if (act.callIn) {
    const owed = (owes: string) =>
      map.favours.find((f) => f.owes === owes && f.to === actor);
    const direct = owed(decider);
    const through = map.favours.find(
      (f) => f.to === actor && hasSway(map, f.owes, decider),
    );
    // A favour called in is paid, so it cannot be called in twice.
    const paid = direct ?? through;
    if (paid) map.favours = map.favours.filter((f) => f !== paid);
    if (direct) vacancy.calledIn.push(actor);
    else if (through) keep(written.acts.callIn.sway, through.owes);
  }
  if (act.credit) vacancy.credit = actor;
  if (act.story && actor !== YOU) keep(written.acts.story, actor);
  if (act.diary && actor !== YOU && actor !== decider) {
    map.favours.push({ owes: decider, to: actor, why: written.acts.diary });
  }
}

/**
 * What counts with whoever decides, for one candidate, all of it hidden truth
 * and none of it the Org Chart, Official standing or a Gauge. For a Character:
 * being the one deciding, being owed a favour by them, being under them on the
 * Power Map, and holding the Plan's credit. For the player: favours owed and
 * called in, the Plan's credit, the Plan really delivered, real results, looking
 * the part, what has reached the one deciding of them, and any big mistake made
 * while the seat was open.
 */
function reasonsFor(
  state: State,
  content: Content,
  written: Written,
  vacancy: Vacancy,
  decider: string,
  who: string,
): VacancyReason[] {
  const map = state.truth.powerMap;
  const owes = map.favours.some((f) => f.owes === decider && f.to === who);
  const reasons: VacancyReason[] = [];
  if (vacancy.credit === who) reasons.push("credited");
  if (vacancy.calledIn.includes(who)) reasons.push("calledIn");
  if (who === YOU) {
    const done =
      vacancy.way === "plan" && planCompleted(state, content, vacancy.holder);
    const { played } = state;
    const looks = (played.impress ?? 0) + (played.fabricate ?? 0);
    if (owes) reasons.push("owedYou");
    if (done && done.counted && done.how === "reality") {
      reasons.push("delivered");
    }
    if ((played.deliver ?? 0) >= written.resultsAt) reasons.push("results");
    if (looks >= written.looksAt) reasons.push("looks");
    reasons.push(moodOfCharacter(state, content, decider));
    if (
      state.mistakes.some(
        (m) => m.month >= vacancy.opened && m.month <= vacancy.decides,
      )
    ) {
      reasons.push("mistake");
    }
    return reasons;
  }
  // Whoever decides needs no other reason to pick themselves.
  if (who === decider) return ["self"];
  if (owes) reasons.push("owed");
  if (influencerOf(map, who) === decider) reasons.push("protege");
  else if (isUnder((id) => influencerOf(map, id), who, decider)) {
    reasons.push("circle");
  }
  return reasons;
}

function weigh(
  state: State,
  content: Content,
  written: Written,
  vacancy: Vacancy,
  decider: string,
  who: string,
): Candidate {
  const kind = kindOf(state, decider);
  const reasons = reasonsFor(state, content, written, vacancy, decider, who);
  const strength = reasons.reduce(
    (sum, r) => sum + written.reasons[r].weight[kind],
    0,
  );
  return { who, reasons, strength };
}

/** Whether whoever decides, being this kind, will not give the seat to this candidate. */
function isRuledOut(written: Written, kind: Kind, candidate: Candidate) {
  return candidate.reasons.some((r) =>
    written.reasons[r].rulesOut.includes(kind),
  );
}

/**
 * The strongest candidates not ruled out, unless all of them are, and the one
 * of those drawn, by the seed, to have the seat.
 */
function pick(
  state: State,
  written: Written,
  seat: Seat,
  kind: Kind,
  candidates: Candidate[],
): { winner: string; top: Candidate[] } {
  const standing = candidates.filter((c) => !isRuledOut(written, kind, c));
  const field = standing.length > 0 ? standing : candidates;
  const best = Math.max(...field.map((c) => c.strength));
  const top = field.filter((c) => c.strength === best);
  const drawn = drawFor(state.seed, `vacancy:${seat.id}`, state.month);
  return { winner: top[Math.floor(drawn * top.length)]?.who ?? YOU, top };
}

/**
 * Whoever really holds influence over the seat decides it, each by their own
 * kind: a Believer weighs what was really delivered, a Practitioner favours and
 * protégés, an Incompetent who looks the part. The candidates are the player and
 * whoever competes for it, and the strongest reasons win, with a seeded draw
 * among equals. A big mistake while it was open can rule the player out, and
 * if nobody else stands for it, the holder's team is weighed instead. The
 * winner takes the seat, with the title it had, or a created post's, and
 * whoever answered to the holder answers to them. Winning takes the player to
 * the seat's floor, or for the seat that is the way out of the top floor, wins
 * the run, which ends there, with nobody moved. Each Character who stood for it
 * and was passed over remembers; one weighed only because nobody stood does not.
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
  const decider = deciderOf(state, vacancy);
  const kind = kindOf(state, decider);
  const weighOf = (who: string) =>
    weigh(state, content, written, vacancy, decider, who);
  const you = weighOf(YOU);
  const competing = competitionNow(state, content)
    .competing.filter(
      (c) => c.for.includes(seat.competing) && c.character !== holder,
    )
    .map((c) => c.character);
  const stood = competing.map(weighOf);
  // A player taken down a floor while it was open is no longer in the running.
  const running = state.job === seat.floor;
  const others =
    stood.length > 0 || (running && !isRuledOut(written, kind, you))
      ? stood
      : teamOf(state, content, holder).map(weighOf);
  const field = running ? [you, ...others] : others;
  if (field.length === 0) {
    // With the player out of the running and nobody else, the seat stays
    // empty: a holder moving up stays put, and one gone is still covered.
    state.vacancies = state.vacancies.filter((v) => v !== vacancy);
    return;
  }
  const { winner, top } = pick(state, written, seat, kind, field);
  // Who would have had it without the mistake, against those who stood for it,
  // which says whether it cost the seat.
  const mistaken = you.reasons.includes("mistake");
  const unmistaken: Candidate = {
    ...you,
    reasons: you.reasons.filter((r) => r !== "mistake"),
    strength:
      you.strength - (mistaken ? written.reasons.mistake.weight[kind] : 0),
  };
  const otherwise = running
    ? pick(state, written, seat, kind, [unmistaken, ...stood])
    : { winner };
  const paper = standingOnPaper(state, content);
  const decided: Decided = {
    month: state.month,
    decider,
    kind,
    winner,
    close: top.length > 1,
    blocked: winner !== YOU && otherwise.winner === YOU,
    candidates: field,
    onPaper: paper?.band ?? null,
    held:
      vacancy.way === "created"
        ? seat.created
        : titleHeld(state, content, holder),
  };
  vacancy.decided = decided;
  // What everyone is called is read before anyone moves.
  const called = (id: string) =>
    id === YOU ? written.you : calledBy(state, content, id);
  const words = { "{winner}": called(winner), "{holder}": called(holder) };
  const inFact = sayPeople(written.inFact, {
    "{decider}": called(decider),
    "{why}": toldOf(written, decided, called),
  });
  if (winner === YOU && seat.win) state.wonIn = state.month;
  else fillSeat(state, content, seat, vacancy, decided);
  const { forYou, forSomeoneElse } = written.passedOver;
  const kept = winner === YOU ? forYou : forSomeoneElse;
  for (const { who } of stood) {
    if (who === YOU || who === winner) continue;
    remember(state, content, {
      character: who,
      about: kept.about,
      text: sayPeople(kept.text, words),
      tone: kept.tone,
    });
  }
  // A player taken down a floor meanwhile is not told of it, but at the end.
  if (!running) return;
  const told =
    winner === YOU ? seat.won : decided.blocked ? seat.blocked : seat.lost;
  state.noticesDue.push({
    title: sayPeople(told.title, words),
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

/**
 * The winner takes the seat on the Org Chart: they answer to whoever its holder
 * answered to, and its holder's team answers to them. A holder moving up goes
 * where the seat sends them. One who has left is gone already, and one whose
 * team a post was created out of stays where they are, with nobody under them.
 */
function fillSeat(
  state: State,
  content: Content,
  seat: Seat,
  { holder, way }: Vacancy,
  { winner, held }: Decided,
): void {
  const above = managerHere(state, content, holder) ?? seat.movesUp.reportsTo;
  // A player taken down a floor meanwhile stays where they are.
  const you = state.job === seat.floor ? [YOU] : [];
  const team = [...you, ...teamOf(state, content, holder)];
  if (way === "plan" || way === "movedUp") {
    state.reportsTo[holder] = seat.movesUp.reportsTo;
    state.titles[holder] = {
      title: seat.movesUp.title,
      called: seat.movesUp.called,
    };
  }
  state.reportsTo[winner] = above;
  if (winner !== YOU) state.titles[winner] = held;
  else if (seat.job !== undefined) state.job = seat.job;
  for (const id of team.filter((t) => t !== winner)) {
    state.reportsTo[id] = winner;
  }
}

/**
 * A candidate's reasons, those that weighed most with this kind first. A
 * mistake counts only when it cost the player the seat, and then comes first.
 */
function weighed(
  written: Written,
  decided: Decided,
  who: string,
): Written["reasons"][VacancyReason][] {
  const { kind, blocked } = decided;
  const candidate = decided.candidates.find((c) => c.who === who);
  const cost = (r: VacancyReason) => (r === "mistake" ? 1 : 0);
  return (candidate?.reasons ?? [])
    .filter((r) => r !== "mistake" || blocked)
    .filter((r) => written.reasons[r].weight[kind] !== 0 || cost(r) > 0)
    .sort(
      (a, b) =>
        cost(b) - cost(a) ||
        written.reasons[b].weight[kind] - written.reasons[a].weight[kind],
    )
    .map((r) => written.reasons[r]);
}

/**
 * Said as it is decided: the winner's tie to whoever decided, in words that never
 * say how anyone feels about the player, or who is a Rival.
 */
function toldOf(
  written: Written,
  decided: Decided,
  called: (id: string) => string,
): string {
  const tie = weighed(written, decided, decided.winner).find(
    (r) => r.told !== undefined,
  )?.told;
  // A seat the player's mistake cost them is told as that, instead of any tie.
  const cost = decided.blocked ? written.reasons.mistake.told : undefined;
  const line =
    cost ?? (decided.close ? written.close : (tie ?? written.untold));
  return sayPeople(line, {
    "{decider}": called(decided.decider),
    "{who}": called(decided.winner),
  });
}

/** Who really decided, and every reason that weighed, for the results screen. */
function explain(
  written: Written,
  decided: Decided,
  called: (id: string) => string,
): string {
  const whyOf = (who: string) => {
    const why = weighed(written, decided, who).map((r) => r.why);
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
    id === YOU ? written.you : personOf(state, content, id).name;
  return state.vacancies.flatMap(({ holder, way, decided }) => {
    if (!decided) return [];
    return [
      {
        month: decided.month,
        text: sayPeople(written.results[way], {
          "{holder}": nameOf(holder),
          "{winner}": nameOf(decided.winner),
        }).replaceAll("{month}", String(decided.month)),
        onPaper: decided.onPaper,
        inFact: explain(written, decided, nameOf),
      },
    ];
  });
}
