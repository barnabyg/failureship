import type { Content } from "./content";
import { applyOutcome } from "./outcome";
import { seatPending } from "./reads";
import { drawFor } from "./rng";
import type { State, Step } from "./state";

type CompanyEvent = Content["events"][number];

/** The first month a scheduled event lands in on this deal, if it ever does. */
function landingMonth(seed: number, event: CompanyEvent): number | null {
  const { schedule } = event;
  if (!schedule) return null;
  const month = schedule.months.find(
    (m) => drawFor(seed, `event:${event.id}`, m) < schedule.chance,
  );
  return month ?? null;
}

/** Whether a disaster with no clue arrives this month, and which, by named draws. */
function drawDisaster(
  state: State,
  content: Content,
): CompanyEvent | undefined {
  const { seed, month } = state;
  if (drawFor(seed, "disaster", month) >= content.balance.disasterChance) {
    return undefined;
  }
  const open = content.events.filter(
    (e) =>
      e.disaster &&
      (e.floor === undefined || e.floor === state.job) &&
      !state.eventsLanded.some((l) => l.id === e.id),
  );
  return open[Math.floor(drawFor(seed, "disaster-which", month) * open.length)];
}

/** As a month opens: what is coming this month, and any clue to what is on its way. */
export function scheduleEvents(state: State, content: Content): void {
  for (const event of content.events) {
    const landing = landingMonth(state.seed, event);
    // An event for one floor passes by a player on another.
    const here = event.floor === undefined || event.floor === state.job;
    if (landing === null || !here) continue;
    if (landing === state.month) state.eventsDue.push(event.id);
    const clue = event.schedule?.clue;
    if (clue && landing - clue.before === state.month) {
      state.clues.push({
        month: state.month,
        source: clue.source,
        text: clue.text,
        verdict: "held",
      });
    }
  }
  const disaster = drawDisaster(state, content);
  if (disaster) state.eventsDue.push(disaster.id);
}

/**
 * A Company Event lands after the player's actions, before the month closes.
 * One for another floor than the player's passes by. One that would open a
 * seat waits while a seat is still to be decided, and lands in the first month
 * after it is, unless the run would end before the seat it opens is decided.
 */
export function landEvent(state: State, content: Content): Step | null {
  const eventOf = (id: string) => content.events.find((e) => e.id === id);
  const openFor = content.vacancies?.seats.find(
    (s) => s.floor === state.job,
  )?.openFor;
  const tooLate =
    openFor === undefined ||
    state.month + openFor > content.balance.monthsPerRun;
  state.eventsDue = state.eventsDue.filter((due) => {
    const event = eventOf(due);
    const here = event?.floor === undefined || event.floor === state.job;
    return here && !(event?.vacates !== undefined && tooLate);
  });
  const waits = (id: string) =>
    eventOf(id)?.vacates !== undefined && seatPending(state);
  const id = state.eventsDue.find((due) => !waits(due));
  const event = id === undefined ? undefined : eventOf(id);
  if (!event) return null;
  state.eventsDue.splice(state.eventsDue.indexOf(event.id), 1);
  state.eventsLanded.push({ id: event.id, month: state.month });
  applyOutcome(state, content, event, event.title);
  return { kind: "event", id: event.id };
}
