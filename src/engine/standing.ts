import type { Content } from "./content";
import type { State } from "./state";

type Written = NonNullable<Content["standing"]>;

/**
 * The player's Official standing: what the paperwork says. It reads only the
 * official record, the player's own deeds, the Project's reported status and a
 * Final Warning, and never the truth of the run. It decides nothing.
 */
function standingOf(state: State, written: Written) {
  const deeds = state.deeds.reduce(
    (sum, deed) =>
      sum + (written.deeds.find((d) => d.flag === deed.flag)?.by ?? 0),
    0,
  );
  const reported = written.reported[state.project.reported] ?? 0;
  const capped = Math.min(100, Math.max(0, written.start + deeds + reported));
  const value = state.finalWarning
    ? Math.min(capped, written.finalWarning)
    : capped;
  // The bands start at 0, so one always holds.
  const band = written.bands.findLast((b) => b.from <= value);
  return {
    label: written.label,
    /** How far along the bar, from 0 to 1, for drawing it. */
    at: value / 100,
    band: band?.label ?? "",
    onPaper: band?.onPaper ?? "",
  };
}

/** In plain view at every step: a bar, with no number the player sees. */
export function standingInView(state: State, content: Content) {
  const written = content.standing;
  if (!written) return null;
  const { label, at, band } = standingOf(state, written);
  return { label, title: written.title, at, band };
}

/** Where it ended, what the results screen says of that, and who decides. */
export function standingAtEnd(state: State, content: Content) {
  const written = content.standing;
  if (!written) return null;
  return { ...standingOf(state, written), decides: written.decides };
}
