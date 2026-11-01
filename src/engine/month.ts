import { landBill, playThreads } from "./bills";
import { landEvent, scheduleEvents } from "./company-events";
import { everyNotification, type Content } from "./content";
import { dealWithAbsence, followUpDemands } from "./demands";
import { applyOutcome } from "./outcome";
import { surfaceRisks } from "./risks";
import {
  actionsThisMonth,
  costOf,
  inMonth,
  isAvailable,
  matches,
  remaining,
} from "./reads";
import { drawFor, pick } from "./rng";
import { openScene } from "./scenes";
import type { MonthRecord, State, Step, World } from "./state";

export function freshMonth(content: Content, month: number): MonthRecord {
  return {
    noted: [],
    spent: 0,
    visited: [],
    // What belongs to this month first, and what recurs, like the report, last.
    unanswered: [...content.notifications, ...(content.demands?.items ?? [])]
      .filter((n) => inMonth(n, month))
      .sort((a, b) => Number(!a.months) - Number(!b.months))
      .map((n) => n.id),
    flags: [],
    moveLanded: false,
    absenceDealtWith: false,
  };
}

/** What happens as a month opens, whatever the player has done. */
export function openMonth(state: State, content: Content): void {
  followUpDemands(state, content);
  playThreads(state, content);
  surfaceRisks(state, content);
  scheduleEvents(state, content);
  const { input } = content.project;
  const colleague = state.truth.characters.find(
    (c) => c.id === input?.character,
  );
  if (input && colleague && inMonth(input, state.month)) {
    const value = drawFor(state.seed, "report-input", state.month);
    if (value < input.chance[colleague.kind]) {
      applyOutcome(state, content, { sets: [input.sets] }, input.sets);
    }
  }
  for (const event of content.project.events) {
    if (inMonth(event, state.month)) {
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
  // What the boss thinks is mostly about lately, so it stays worth reading.
  // Adding zero turns -0 into 0, which is all that a save can hold.
  state.truth.bossOpinion =
    Math.trunc(state.truth.bossOpinion * world.content.balance.opinion.keeps) +
    0;
  Object.assign(state, freshMonth(world.content, state.month));
  openMonth(state, world.content);
  state.step = nextStep(state, world);
}

/**
 * The month's order: Notifications, actions, any Company Event, a Move, and then
 * the month closes.
 */
export function nextStep(state: State, world: World): Step {
  const { content } = world;
  const due = state.noticesDue.shift();
  if (due) return { kind: "notice", ...due };
  if (state.firedIn !== null) return { kind: "results" };
  const notifications = everyNotification(content);
  for (const id of state.unanswered) {
    const notification = notifications.find((n) => n.id === id);
    const answerable = notification?.options.some(
      (o) => costOf(content, o.cost) <= remaining(state, content),
    );
    if (answerable && matches(state, content, notification?.when)) {
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
  if (
    actionsThisMonth(state, content).some((a) => isAvailable(state, content, a))
  ) {
    return { kind: "actions" };
  }
  return (
    dealWithAbsence(state, content) ??
    landEvent(state, content) ??
    landBill(state, content) ??
    landMove(state, content) ?? { kind: "story" }
  );
}

/** Picks the month's Character Move from those whose conditions hold. */
function landMove(state: State, content: Content): Step | null {
  if (state.moveLanded) return null;
  state.moveLanded = true;
  const eligible = content.moves.filter(
    (m) => inMonth(m, state.month) && matches(state, content, m.when),
  );
  if (eligible.length === 0) return null;
  const fresh = eligible.filter((m) => !state.movesLanded.includes(m.id));
  const urgent = fresh.filter((m) => m.priority);
  const pool = urgent.length > 0 ? urgent : fresh;
  const { item, next } = pick(state.rng, pool.length > 0 ? pool : eligible);
  state.rng = next;
  state.movesLanded.push(item.id);
  applyOutcome(state, content, item, item.title);
  return { kind: "move", id: item.id };
}
