import type { Content } from "./content";
import type { State } from "./state";
import { monthAfter } from "./threads";

/** Adds any hidden risk this flag builds up, once in a run. */
export function startRisks(
  state: State,
  content: Content,
  flags: readonly string[],
): void {
  for (const risk of content.risks) {
    if (
      !flags.includes(risk.addedBy) ||
      state.truth.risks.some((r) => r.id === risk.id)
    ) {
      continue;
    }
    state.truth.risks.push({
      id: risk.id,
      month: state.month,
      due: monthAfter(state, `risk-wait:${risk.id}`, risk.after),
      cameOut: null,
    });
  }
}
