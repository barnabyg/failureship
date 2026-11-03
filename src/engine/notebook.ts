import type { Content } from "./content";
import { isOn } from "./floors";
import { matches } from "./reads";
import type { State } from "./state";

/** Keeps a clue of whatever the Notebook is written to keep, once in a month. */
export function noteEvents(state: State, content: Content): void {
  for (const event of content.notebook.events) {
    if (
      !state.noted.includes(event.id) &&
      isOn(state, content, event) &&
      matches(state, content, event.when)
    ) {
      state.noted.push(event.id);
      state.clues.push({
        month: state.month,
        source: event.source,
        text: event.text,
        verdict: event.verdict,
      });
    }
  }
}
