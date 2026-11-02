import type { Content } from "./content";
import type { State, Step } from "./state";

type Written = NonNullable<Content["gauges"]>[number];

/**
 * The only place a Gauge is read. Gauges are the player's track record, so they
 * move only when a Thread plays out, and nothing in the rules but Milestones reads
 * them: never the Power Map, a hidden risk or anyone's opinion.
 */
export function startingGauges(
  content: Content,
): Pick<State, "gauges" | "gaugeMoves" | "gaugesDue" | "milestones"> {
  return {
    gauges: Object.fromEntries(
      (content.gauges ?? []).map((g) => [g.id, g.start]),
    ),
    gaugeMoves: [],
    gaugesDue: [],
    milestones: [],
  };
}

/** A Thread has played out: its Gauges move as the month closes. */
export function gaugesFromThread(
  state: State,
  moves: readonly { gauge: string; by: number; note: string }[],
): void {
  state.gaugesDue.push(...moves);
}

function clamp(gauge: Written, value: number): number {
  return Math.min(gauge.max, Math.max(gauge.min, value));
}

/** As the month closes, Gauges move, and any Milestone reached is told first. */
export function closeGauges(state: State, content: Content): Step | null {
  for (const move of state.gaugesDue.splice(0)) {
    const gauge = content.gauges?.find((g) => g.id === move.gauge);
    if (!gauge) continue;
    const was = state.gauges[gauge.id] ?? gauge.start;
    const now = clamp(gauge, was + move.by);
    state.gauges[gauge.id] = now;
    state.gaugeMoves.push({ month: state.month, ...move, by: now - was });
    for (const milestone of gauge.milestones) {
      const earned = state.milestones.some(
        (m) => m.gauge === gauge.id && m.at === milestone.at,
      );
      if (!earned && was < milestone.at && now >= milestone.at) {
        state.milestones.push({
          gauge: gauge.id,
          at: milestone.at,
          month: state.month,
        });
        state.noticesDue.push({ title: milestone.title, body: milestone.body });
      }
    }
  }
  const told = state.noticesDue.shift();
  return told ? { kind: "notice", ...told } : null;
}

function milestoneOf(content: Content, gauge: string, at: number) {
  return content.gauges
    ?.find((g) => g.id === gauge)
    ?.milestones.find((m) => m.at === at);
}

/** In plain view at every step: each Gauge, and which Thread moved it. */
export function gaugesInView(state: State, content: Content) {
  return {
    gauges: (content.gauges ?? []).map((g) => ({
      id: g.id,
      label: g.label,
      value: state.gauges[g.id] ?? g.start,
      moves: state.gaugeMoves
        .filter((m) => m.gauge === g.id)
        .map(({ month, by, note }) => ({ month, by, note })),
    })),
    milestones: state.milestones.flatMap(({ gauge, at, month }) => {
      const written = milestoneOf(content, gauge, at);
      return written ? [{ month, title: written.title }] : [];
    }),
  };
}

/** What moved a Gauge this month, for the official story. */
export function gaugesThisMonth(state: State, content: Content): string[] {
  return state.gaugeMoves
    .filter((m) => m.month === state.month)
    .map((m) => {
      const label = content.gauges?.find((g) => g.id === m.gauge)?.label ?? "";
      const by = m.by > 0 ? `+${String(m.by)}` : String(m.by);
      return `${label} ${by}. ${m.note}`;
    });
}
