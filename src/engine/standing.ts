import type { Content } from "./content";
import type { State } from "./state";

/**
 * The player's Official standing: what the paperwork says. It reads only the
 * official record, the player's own deeds, the Project's reported status and a
 * Final Warning, and never the truth of the run. It decides nothing.
 */
function standingOf(state: State, written: NonNullable<Content["standing"]>) {
  const deeds = state.deeds.reduce(
    (sum, deed) =>
      sum + (written.deeds.find((d) => d.flag === deed.flag)?.by ?? 0),
    0,
  );
  const reported = written.reported[state.project.reported] ?? 0;
  const value = Math.min(100, Math.max(0, written.start + deeds + reported));
  return state.finalWarning ? Math.min(value, written.finalWarning) : value;
}

function bandOf(written: NonNullable<Content["standing"]>, value: number) {
  return written.bands.findLast((b) => b.from <= value) ?? written.bands[0];
}

/** In plain view at every step: a bar, with no number the player sees. */
export function standingInView(state: State, content: Content) {
  const written = content.standing;
  if (!written) return null;
  const value = standingOf(state, written);
  return {
    label: written.label,
    title: written.title,
    /** How far along the bar, from 0 to 1, for drawing it. */
    at: value / 100,
    band: bandOf(written, value)?.label ?? "",
  };
}

/** Where it ended, and what the results screen says of that. */
export function standingAtEnd(state: State, content: Content) {
  const written = content.standing;
  if (!written) return null;
  const value = standingOf(state, written);
  const band = bandOf(written, value);
  return {
    label: written.label,
    at: value / 100,
    band: band?.label ?? "",
    onPaper: band?.onPaper ?? "",
  };
}
