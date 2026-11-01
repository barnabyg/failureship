import { sendBill } from "./bills";
import type { Content } from "./content";
import { matches } from "./reads";
import { drawFor } from "./rng";
import type { State } from "./state";

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
