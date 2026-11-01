import type { Content } from "./content";
import { lowerOnMap, raiseOnMap } from "./deal";
import { applyOutcome } from "./outcome";
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
    (e) => e.disaster && !state.eventsLanded.some((l) => l.id === e.id),
  );
  return open[Math.floor(drawFor(seed, "disaster-which", month) * open.length)];
}

/** As a month opens: what is coming this month, and any clue to what is on its way. */
export function scheduleEvents(state: State, content: Content): void {
  for (const event of content.events) {
    const landing = landingMonth(state.seed, event);
    if (landing === null) continue;
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

/** Moves people on the charts. A move that would make a loop does not happen. */
function reshuffle(state: State, event: CompanyEvent): void {
  const { reports, rises, falls } = event.reshuffle;
  for (const { character, to } of reports) {
    const above = (id: string | undefined): boolean =>
      id !== undefined && (id === character || above(state.reportsTo[id]));
    if (!above(to)) state.reportsTo[character] = to;
  }
  const { truth } = state;
  for (const id of rises) truth.powerMap = raiseOnMap(truth.powerMap, id);
  for (const id of falls) truth.powerMap = lowerOnMap(truth.powerMap, id);
}

/** A Company Event lands after the player's actions, before the month closes. */
export function landEvent(state: State, content: Content): Step | null {
  const id = state.eventsDue.shift();
  const event = content.events.find((e) => e.id === id);
  if (!event) return null;
  state.eventsLanded.push({ id: event.id, month: state.month });
  applyOutcome(state, content, event, event.title);
  reshuffle(state, event);
  return { kind: "event", id: event.id };
}
