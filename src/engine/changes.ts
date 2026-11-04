import { sendBill } from "./bills";
import type { Content, Kind } from "./content";
import { canGo, depart } from "./departures";
import { applyOutcome } from "./outcome";
import { mentionsGone, matches } from "./reads";
import { drawFor, pickWeighted } from "./rng";
import type { Change, State } from "./state";

type Written = NonNullable<Content["changing"]>;

/** What has been done to someone, directly, that can burn them. */
function burnsOf(state: State, written: Written, character: string) {
  return state.truth.memories.flatMap((memory) => {
    const burn = written.burns.find((b) => b.about === memory.about);
    // Being told of something done to someone else is not being burned by it.
    const news = state.truth.news[memory.news ?? -1];
    const victim = news?.word?.victim ?? news?.victim;
    const toThem = victim === undefined || victim === character;
    if (memory.character !== character || memory.via !== null || !toThem) {
      return [];
    }
    return burn ? [burn] : [];
  });
}

/**
 * As a month opens, a Believer burned enough changes: into a Practitioner, a
 * whistleblower, or out of the company. Which is seeded, and leans on what was
 * done to them. Nobody else ever changes, and nobody is told.
 */
export function changePeople(state: State, content: Content): void {
  const written = content.changing;
  if (!written) return;
  for (const dealt of state.truth.characters) {
    const changed = state.truth.changes.some((c) => c.character === dealt.id);
    if (dealt.kind !== "believer" || changed) continue;
    const burns = burnsOf(state, written, dealt.id);
    const weight = burns.reduce((sum, b) => sum + b.weight, 0);
    if (weight < written.threshold) continue;
    // Anyone written to can leave, a boss included, unless it would leave
    // nobody in a place above the player.
    const canLeave =
      dealt.id in written.leaving && canGo(state, content, dealt.id);
    const ways = (["practitioner", "whistleblower", "left"] as const).filter(
      (way) => way !== "left" || canLeave,
    );
    const leaning = (way: (typeof ways)[number]) =>
      burns.reduce((sum, b) => sum + b.leans[way], 0);
    if (ways.every((way) => leaning(way) === 0)) continue;
    const value = drawFor(state.seed, `change:${dealt.id}`, state.month);
    const to = pickWeighted(Math.floor(value * 2 ** 32), ways, leaning).item;
    state.truth.changes.push({
      character: dealt.id,
      month: state.month,
      from: dealt.kind,
      to,
      why: [...new Set(burns.map((b) => b.why))],
      acted: false,
    });
    if (to === "practitioner") dealt.kind = "practitioner";
    if (to === "left") leave(state, content, written, dealt.id);
  }
}

/** Gone for the rest of the run, with the notice that says so. */
function leave(
  state: State,
  content: Content,
  written: Written,
  id: string,
): void {
  const leaving = written.leaving[id];
  if (!leaving) return;
  // Told before the seat it may leave open.
  state.noticesDue.push({ ...leaving.notice, asWritten: true });
  depart(state, content, id, "left");
  applyOutcome(
    state,
    content,
    { sets: leaving.sets, project: leaving.project },
    leaving.notice.title,
  );
}

/** What a whistleblower knows comes out: a hidden risk if there is one, or a report. */
export function blowWhistles(state: State, content: Content): void {
  const written = content.changing;
  if (!written) return;
  for (const change of state.truth.changes) {
    if (change.to !== "whistleblower" || change.acted) continue;
    if (change.month >= state.month) continue;
    // What they know about first, then whatever is buried, then anything at all.
    change.acted =
      report(state, content, written, true) ||
      bringOutRisk(state, content, change) ||
      report(state, content, written, false);
  }
}

function bringOutRisk(state: State, content: Content, change: Change): boolean {
  const risk = state.truth.risks.find((r) => r.cameOut === null);
  const written = content.risks.find((r) => r.id === risk?.id);
  if (!risk || !written) return false;
  const traced = matches(state, content, written.traced);
  risk.cameOut = {
    month: state.month,
    onPlayer: traced,
    through: change.character,
  };
  if (written.event !== undefined) state.eventsDue.push(written.event);
  const bill = traced ? written.onPlayer : written.onSomeoneElse;
  if (bill && !mentionsGone(state, content, bill.from ?? "")) {
    sendBill(state, content, bill);
  }
  return true;
}

function report(
  state: State,
  content: Content,
  written: Written,
  known: boolean,
): boolean {
  const reported = written.whistleblower.reports.find(
    (r) => (r.when !== undefined) === known && matches(state, content, r.when),
  );
  if (!reported) return false;
  sendBill(state, content, reported.bill);
  return true;
}

/**
 * What a Character can be seen doing. A whistleblower's own signs take their `share`
 * of it, and what any Believer might show takes the rest, so no one sign settles it.
 */
export function signsOpenTo(
  state: State,
  content: Content,
  character: string,
  open: readonly { id: string; weight: number }[],
): { id: string; weight: number }[] {
  const own = signsOfChange(state, content, character);
  const share = content.changing?.whistleblower.share ?? 0;
  const ownTotal = own.reduce((sum, s) => sum + s.weight, 0);
  const rest = open.reduce((sum, b) => sum + b.weight, 0);
  if (own.length === 0 || rest === 0) return [...open, ...own];
  const scale = (share * rest) / ((1 - share) * ownTotal);
  return [...open, ...own.map((s) => ({ id: s.id, weight: s.weight * scale }))];
}

/** Someone's own signs as a whistleblower, beside what anyone of their kind shows. */
export function signsOfChange(
  state: State,
  content: Content,
  character: string,
) {
  const change = state.truth.changes.find((c) => c.character === character);
  return change?.to === "whistleblower"
    ? (content.changing?.whistleblower.signs ?? [])
    : [];
}

/** What a Character started as, which the results screen shows. */
export function startedAs(state: State, character: string, kind: Kind): Kind {
  return (
    state.truth.changes.find((c) => c.character === character)?.from ?? kind
  );
}
