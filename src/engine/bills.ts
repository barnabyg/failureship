import { everyBill, type Bill, type Content } from "./content";
import { applyOutcome } from "./outcome";
import { matches } from "./reads";
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

/** A Bill that comes as a Character Move lands where Moves do. */
export function landBill(state: State, content: Content): Step | null {
  const id = state.billsDue.shift();
  const bill = everyBill(content).find((b) => b.id === id);
  if (!bill) return null;
  applyOutcome(state, content, bill, bill.title);
  return { kind: "move", id: bill.id };
}
