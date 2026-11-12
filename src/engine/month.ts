import { landBill, playThreads, surfaceRisks } from "./bills";
import { inInbox, nextEscape } from "./escapes";
import { blowWhistles, changePeople } from "./changes";
import { landEvent, scheduleEvents } from "./company-events";
import { everyNotification, type Content } from "./content";
import { dealsFallDue } from "./deals";
import { demoteForMistakes } from "./demotions";
import { dealWithAbsence, followUpDemands } from "./demands";
import { isOn, recurs, startMonthOnFloor, type Whereabouts } from "./floors";
import { closeGauges } from "./gauges";
import { followPlans } from "./grand-plans";
import { applyOutcome } from "./outcome";
import { bossOf, isGone } from "./places";
import { promisesFallDue } from "./promises";
import { spreadNews, startStory } from "./reputation";
import {
  actionsThisMonth,
  beliefOf,
  costOf,
  isAvailable,
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
import { fillVacancies } from "./vacancies";
import { openScene } from "./scenes";
import type { Landing, MonthRecord, State, Step, World } from "./state";

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
    closed: false,
    notes: [],
    landed: [],
  };
}

/**
 * What happens as a month opens, whatever the player has done. Whatever it
 * tells waits in the inbox to be read, unless it is urgent.
 */
export function openMonth(state: State, content: Content): void {
  const before = state.noticesDue.length;
  happenAsMonthOpens(state, content);
  const told = state.noticesDue.splice(before);
  state.noticesDue.push(...told.filter((n) => n.urgent));
  state.notes.push(...told.filter((n) => !n.urgent));
}

function happenAsMonthOpens(state: State, content: Content): void {
  // Plans past due fail before anything else this month can complete them.
  followPlans(state, content);
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
  // Between months, so that a new floor counts from the next. A demotion goes
  // first, so that a seat won as a month closes is not lost to its own mistakes.
  demoteForMistakes(state, world.content);
  fillVacancies(state, world.content);
  if (
    state.wonIn !== null ||
    state.month === (world.endsAfter ?? world.content.balance.monthsPerRun)
  ) {
    // A seat decided as the run ends is still told, before the results, and
    // so is the one that wins it.
    state.closed = true;
    state.step = nextStep(state, world);
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
 * The Notifications in the inbox, in the order they arrive: those still to be
 * answered this month, including any the actions left cannot pay for.
 */
export function inboxMail(state: State, content: Content): string[] {
  const notifications = everyNotification(content);
  return state.unanswered.filter((id) => {
    const notification = notifications.find((n) => n.id === id);
    return (
      notification !== undefined &&
      !mentionsGone(state, content, notification.from) &&
      matches(state, content, notification.when)
    );
  });
}

/** The Notifications that can be answered now, in the order they arrive. */
export function answerable(state: State, content: Content): string[] {
  const notifications = everyNotification(content);
  return inboxMail(state, content).filter((id) =>
    optionsOnOffer(
      state,
      content,
      notifications.find((n) => n.id === id)?.options ?? [],
    ).some((o) => costOf(content, o.cost) <= remaining(state, content)),
  );
}

/**
 * The actions kept for the inbox: the least that answering each e-mail in it
 * can cost, so that the floor cannot spend what an answer needs.
 */
function keptForInbox(state: State, content: Content): number {
  const notifications = everyNotification(content);
  return answerable(state, content)
    .map((id) =>
      Math.min(
        ...optionsOnOffer(
          state,
          content,
          notifications.find((n) => n.id === id)?.options ?? [],
        ).map((o) => costOf(content, o.cost)),
      ),
    )
    .reduce((sum, cost) => sum + cost, 0);
}

/**
 * Whether an action on the floor can be taken now: it is available, and
 * taking it leaves enough to answer the inbox, so that the month cannot close
 * with an e-mail left unanswered for want of an action.
 */
export function canTakeNow(
  state: State,
  content: Content,
  action: Content["actions"][number],
): boolean {
  const cost = costOf(content, action.cost);
  return (
    isAvailable(state, content, action) &&
    (cost === 0 ||
      cost + keptForInbox(state, content) <= remaining(state, content))
  );
}

/**
 * Whether the step lets the player use the floor and their inbox: it is the
 * floor, or something in the inbox, which can be answered in any order.
 */
export function onTheFloor(state: State, content: Content): boolean {
  const { step } = state;
  return (
    step.kind === "actions" ||
    step.kind === "notification" ||
    (step.kind === "escape" && inInbox(content, step.id))
  );
}

/**
 * The month's order. Anything urgent is told first. Then the floor opens, with
 * the inbox: any consequence to escape that came as the month opened, and the
 * Notifications, which the player answers in any order, beside their actions.
 * The step names whatever is at the top of the inbox. Once the inbox is clear,
 * any flagged Project and any review come, and the month closes once the
 * actions are spent and the inbox is clear. What then lands with nothing to
 * choose is told in the official story, and a consequence that comes as a Move
 * asks for its Escape in place, as the month closes.
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
  if (state.firedIn !== null || state.closed) {
    // The stand-in for winning comes once, after the decision that won it.
    const won = state.wonIn !== null && state.step.kind !== "win";
    return won ? { kind: "win" } : { kind: "results" };
  }
  const escape = nextEscape(state, content);
  if (escape) return escape;
  const [id] = answerable(state, content);
  if (id !== undefined) return { kind: "notification", id };
  const flagged = explainFlagged(state, world);
  if (flagged) return flagged;
  const review = holdReview(state, world);
  if (review) return review;
  if (
    actionsThisMonth(state, content).some((a) => isAvailable(state, content, a))
  ) {
    return { kind: "actions" };
  }
  return closeMonth(state, world);
}

/** A Project flagged red has to be explained, as soon as nothing else waits. */
function explainFlagged(state: State, world: World): Step | null {
  const { content } = world;
  const flag = content.project.flagged;
  if (!flag || !state.project.flagged) return null;
  state.project.flagged = false;
  state.spent = Math.min(
    content.balance.actionsPerMonth,
    state.spent + costOf(content, flag.cost),
  );
  return openScene(state, world, flag.scene);
}

/**
 * As the month closes, everything that lands with nothing to choose is kept
 * for the official story, in the order it lands. A consequence with Escapes
 * stops to ask, and so does anything urgent, such as a big mistake, and a
 * Project flagged red.
 */
function closeMonth(state: State, world: World): Step {
  const { content } = world;
  for (;;) {
    const landing =
      dealWithAbsence(state, content) ??
      landEvent(state, content) ??
      landBill(state, content) ??
      landMove(state, content) ??
      closeGauges(state, content);
    if (landing === null) return { kind: "story" };
    if (landing.kind === "escape") return landing;
    state.landed.push(landing);
    // What a landing told, such as a Milestone, is told with it.
    const told = state.noticesDue.splice(0);
    const urgent = told.filter((n) => n.urgent);
    state.landed.push(
      ...told
        .filter((n) => !n.urgent)
        .map((n) => ({ kind: "notice" as const, ...n })),
    );
    const [first, ...rest] = urgent;
    if (first) {
      state.noticesDue.push(...rest);
      return { kind: "notice", ...first };
    }
    // A landing that flags the Project red is explained at once, as ever.
    const flagged = explainFlagged(state, world);
    if (flagged) return flagged;
  }
}

/** Picks the month's Character Move from those whose conditions hold. */
function landMove(state: State, content: Content): Landing | null {
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
  // A Move that acts for a seat names its maker, as the checks make sure.
  applyOutcome(state, content, item, item.title, by ?? "");
  return { kind: "move", id: item.id, by };
}
