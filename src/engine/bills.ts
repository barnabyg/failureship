import { everyBill, type Bill, type Content } from "./content";
import { applyOutcome } from "./outcome";
import { matches } from "./reads";
import { drawFor } from "./rng";
import type { State, Step } from "./state";

/** A Bill reaches the player: told at once, sent as a message, or kept for the Move. */
export function sendBill(state: State, content: Content, bill: Bill): void {
  if (bill.as === "move") {
    state.billsDue.push(bill.id);
    return;
  }
  applyOutcome(state, content, bill, bill.title);
  if (bill.as === "notification") state.unanswered.unshift(bill.id);
  else state.noticesDue.push({ title: bill.title, body: bill.body });
}

/** As a month opens, each Thread due plays out as the first outcome that holds. */
export function playThreads(state: State, content: Content): void {
  for (const started of state.threads) {
    if (started.due !== state.month) continue;
    const thread = content.threads.find((t) => t.id === started.id);
    const outcome = thread?.outcomes.find((o) =>
      matches(state, content, o.when),
    );
    if (!outcome) continue;
    started.played = { month: state.month, text: outcome.playedOut };
    sendBill(state, content, outcome.bill);
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
    if (!written || !dealt) continue;
    const { route } = written;
    const motive =
      drawFor(state.seed, `risk:${risk.id}`, state.month) <
      route.chance[dealt.kind];
    if (!motive || !matches(state, content, route.means)) continue;
    const traced = matches(state, content, written.traced);
    risk.cameOut = { month: state.month, onPlayer: traced };
    if (written.event !== undefined) state.eventsDue.push(written.event);
    const bill = traced ? written.onPlayer : written.onSomeoneElse;
    if (bill) sendBill(state, content, bill);
  }
}

/** A Bill that comes as a Character Move lands where Moves do. */
export function landBill(state: State, content: Content): Step | null {
  const id = state.billsDue.shift();
  const bill = everyBill(content).find((b) => b.id === id);
  if (!bill) return null;
  applyOutcome(state, content, bill, bill.title);
  return { kind: "move", id: bill.id };
}
