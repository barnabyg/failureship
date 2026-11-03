import { landBill, playThreads, surfaceRisks } from "./bills";
import { blowWhistles, changePeople } from "./changes";
import { landEvent, scheduleEvents } from "./company-events";
import { everyNotification, type Content } from "./content";
import { dealsFallDue } from "./deals";
import { dealWithAbsence, followUpDemands } from "./demands";
import { isOn, recurs, startMonthOnFloor, type Whereabouts } from "./floors";
import { closeGauges } from "./gauges";
import { applyOutcome } from "./outcome";
import { bossOf } from "./places";
import { promisesFallDue } from "./promises";
import { spreadNews, startStory } from "./reputation";
import {
  actionsThisMonth,
  beliefOf,
  costOf,
  isAvailable,
  isGone,
  matches,
  mentionsGone,
  optionsOnOffer,
  remaining,
} from "./reads";
import { holdReview } from "./reviews";
import {
  canMake,
  competitionNow,
  COMPETITOR,
  makerOf,
  noteMoveMade,
  noteRivals,
} from "./rivals";
import { drawFor, pick } from "./rng";
import { openScene } from "./scenes";
import type { MonthRecord, State, Step, World } from "./state";

export function freshMonth(where: Whereabouts, content: Content): MonthRecord {
  return {
    noted: [],
    spent: 0,
    visited: [],
    // What belongs to this month first, and what recurs, like the report, last.
    unanswered: [...content.notifications, ...(content.demands?.items ?? [])]
      .filter((n) => isOn(where, content, n))
      .sort((a, b) => Number(recurs(a)) - Number(recurs(b)))
      .map((n) => n.id),
    flags: [],
    moveLanded: false,
    absenceDealtWith: false,
    reviewed: false,
  };
}

/** What happens as a month opens, whatever the player has done. */
export function openMonth(state: State, content: Content): void {
  spreadNews(state, content);
  changePeople(state, content);
  noteRivals(state, competitionNow(state, content));
  followUpDemands(state, content);
  promisesFallDue(state);
  dealsFallDue(state, content);
  playThreads(state, content);
  surfaceRisks(state, content);
  blowWhistles(state, content);
  scheduleEvents(state, content);
  const { input } = content.project;
  const colleague = state.truth.characters.find(
    (c) => c.id === input?.character && !isGone(state, c.id),
  );
  if (input && colleague && isOn(state, content, input)) {
    const value = drawFor(state.seed, "report-input", state.month);
    if (value < input.chance[colleague.kind]) {
      applyOutcome(state, content, { sets: [input.sets] }, input.sets);
    }
  }
  for (const event of content.project.events) {
    if (isOn(state, content, event)) {
      applyOutcome(state, content, { project: event.project }, event.text);
      state.project.news.push({ month: state.month, text: event.text });
    }
  }
}

/** After the official story: on to the next month, or the end of the run. */
export function leaveStory(state: State, world: World): void {
  if (state.month === world.content.balance.monthsPerRun) {
    state.step = { kind: "results" };
    return;
  }
  state.month += 1;
  startMonthOnFloor(state);
  // What the boss thinks is mostly about lately, so it stays worth reading.
  // Adding zero turns -0 into 0, which is all that a save can hold.
  const character = bossOf(state, world.content);
  state.truth.beliefs[character] =
    Math.trunc(
      beliefOf(state, character) * world.content.balance.bossBeliefKeeps,
    ) + 0;
  Object.assign(state, freshMonth(state, world.content));
  openMonth(state, world.content);
  state.step = nextStep(state, world);
}

/**
 * The month's order: Notifications, any review, actions, any Company Event, a
 * Move, and then the month closes.
 */
export function nextStep(state: State, world: World): Step {
  const { content } = world;
  const due = state.noticesDue.shift();
  if (due) return { kind: "notice", ...due };
  // Answering something from someone who has gone is not on offer.
  state.unanswered = state.unanswered.filter((id) => {
    const from = everyNotification(content).find((n) => n.id === id)?.from;
    return from === undefined || !mentionsGone(state, content, from);
  });
  if (state.firedIn !== null) return { kind: "results" };
  const notifications = everyNotification(content);
  for (const id of state.unanswered) {
    const notification = notifications.find((n) => n.id === id);
    const answerable =
      notification &&
      !mentionsGone(state, content, notification.from) &&
      optionsOnOffer(state, content, notification.options).some(
        (o) => costOf(content, o.cost) <= remaining(state, content),
      );
    if (answerable && matches(state, content, notification.when)) {
      return { kind: "notification", id };
    }
  }
  const flag = content.project.flagged;
  if (flag && state.project.flagged) {
    state.project.flagged = false;
    state.spent = Math.min(
      content.balance.actionsPerMonth,
      state.spent + costOf(content, flag.cost),
    );
    return openScene(state, world, flag.scene);
  }
  const review = holdReview(state, world);
  if (review) return review;
  if (
    actionsThisMonth(state, content).some((a) => isAvailable(state, content, a))
  ) {
    return { kind: "actions" };
  }
  return (
    dealWithAbsence(state, content) ??
    landEvent(state, content) ??
    landBill(state, content) ??
    landMove(state, content) ??
    closeGauges(state, content) ?? { kind: "story" }
  );
}

/** Picks the month's Character Move from those whose conditions hold. */
function landMove(state: State, content: Content): Step | null {
  if (state.moveLanded) return null;
  state.moveLanded = true;
  const competition = competitionNow(state, content);
  const eligible = content.moves.filter(
    (m) =>
      isOn(state, content, m) &&
      canMake(state, content, m.by, competition) &&
      !mentionsGone(state, content, m.from) &&
      matches(state, content, m.when),
  );
  if (eligible.length === 0) return null;
  const fresh = eligible.filter((m) => !state.movesLanded.includes(m.id));
  const urgent = fresh.filter((m) => m.priority);
  // While anyone competes with the player, some months' Move is one of theirs.
  const competed = fresh.filter((m) => m.by === COMPETITOR);
  const competitorsTurn =
    competed.length > 0 &&
    drawFor(state.seed, "rival-move", state.month) <
      (content.rivals?.moveChance ?? 0);
  const pool = urgent.length > 0 ? urgent : competitorsTurn ? competed : fresh;
  const { item, next } = pick(state.rng, pool.length > 0 ? pool : eligible);
  state.rng = next;
  state.movesLanded.push(item.id);
  const by = makerOf(state, content, item, competition);
  noteMoveMade(state, by, item, competition);
  if (item.falseStory && by !== undefined) {
    startStory(state, content, { ...item.falseStory, by });
  }
  applyOutcome(state, content, item, item.title);
  return { kind: "move", id: item.id, by };
}
