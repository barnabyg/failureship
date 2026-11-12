import { everyBill, type Bill, type Content } from "./content";
import { holdForEscape } from "./escapes";
import { gaugesFromThread } from "./gauges";
import { applyOutcome } from "./outcome";
import { matches, mentionsGone } from "./reads";
import { drawFor } from "./rng";
import type { GaugeMove, Landing, State, Step } from "./state";
import { isGone } from "./places";

/**
 * A Bill reaches the player: offered with its Escapes, told at once, sent as a
 * message, or kept for the Move. A Thread's Gauges move with it.
 */
export function sendBill(
  state: State,
  content: Content,
  bill: Bill,
  gauges: readonly GaugeMove[] = [],
): void {
  const held = holdForEscape(state, bill, gauges);
  if (!held) gaugesFromThread(state, gauges);
  if (bill.as === "move") {
    state.billsDue.push(bill.id);
    return;
  }
  if (held) return;
  applyOutcome(state, content, bill, bill.title);
  if (bill.as === "notification") state.unanswered.unshift(bill.id);
  else state.noticesDue.push({ title: bill.title, body: bill.body });
}

/** As a month opens, each Thread due plays out as the first outcome that holds. */
export function playThreads(state: State, content: Content): void {
  for (const started of state.threads) {
    if (started.due !== state.month) continue;
    const thread = content.threads.find((t) => t.id === started.id);
    // Nothing comes back through someone who has gone.
    const outcome = thread?.outcomes.find(
      (o) =>
        !mentionsGone(state, content, o.bill.from ?? "") &&
        matches(state, content, o.when),
    );
    if (!outcome) continue;
    started.played = { month: state.month, text: outcome.playedOut };
    sendBill(state, content, outcome.bill, outcome.gauges);
  }
}

/**
 * As a month opens, each risk due has one chance to come out, if the Character it
 * goes through has the motive and the means. If it comes out, what lands where
 * depends on whether it can be traced to the player. Otherwise it stays hidden.
 */
export function surfaceRisks(state: State, content: Content): void {
  for (const risk of state.truth.risks) {
    if (risk.due !== state.month) continue;
    const written = content.risks.find((r) => r.id === risk.id);
    const dealt = state.truth.characters.find(
      (c) => c.id === written?.route.character,
    );
    if (!written || !dealt || isGone(state, dealt.id)) continue;
    const { route } = written;
    const motive =
      drawFor(state.seed, `risk:${risk.id}`, state.month) <
      route.chance[dealt.kind];
    if (!motive || !matches(state, content, route.means)) continue;
    const traced = matches(state, content, written.traced);
    risk.cameOut = { month: state.month, onPlayer: traced };
    if (written.event !== undefined) state.eventsDue.push(written.event);
    const bill = traced ? written.onPlayer : written.onSomeoneElse;
    if (bill && !mentionsGone(state, content, bill.from ?? "")) {
      sendBill(state, content, bill);
    }
  }
}

/**
 * A Bill that comes as a Character Move lands where Moves do, in the order the
 * Bills were sent. One with Escapes offers them there instead.
 */
export function landBill(
  state: State,
  content: Content,
): Landing | Extract<Step, { kind: "escape" }> | null {
  const id = state.billsDue.shift();
  const bill = everyBill(content).find((b) => b.id === id);
  if (!bill) return null;
  if (state.escapesDue.some((d) => d.bill === bill.id)) {
    return { kind: "escape", id: bill.id };
  }
  applyOutcome(state, content, bill, bill.title);
  return { kind: "move", id: bill.id };
}
