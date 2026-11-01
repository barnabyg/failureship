import type { Content } from "./content";
import type { State } from "./state";

/**
 * A first big mistake is a Final Warning, and another gets the player fired, as
 * does one catastrophic mistake. The player is told before anything else happens.
 */
export function makeMistake(
  state: State,
  content: Content,
  mistake: "big" | "catastrophic",
  label: string,
): void {
  const written = content.mistakes;
  if (!written) throw new Error("Nothing is written for a big mistake.");
  if (state.firedIn !== null) return;
  state.mistakes.push({ month: state.month, choice: label });
  if (mistake === "catastrophic" || state.finalWarning) {
    state.firedIn = state.month;
    state.noticesDue.push(
      mistake === "catastrophic" ? written.firedOutright : written.fired,
    );
    return;
  }
  state.finalWarning = true;
  state.noticesDue.push(written.finalWarning);
}
