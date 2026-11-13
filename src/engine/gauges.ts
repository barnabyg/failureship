import type { Content } from "./content";
import type { GaugeMove, Landing, State } from "./state";

type Written = NonNullable<Content["gauges"]>[number];

/**
 * The only place a Gauge is read. Gauges are the player's track record, so they
 * move only when a Thread or an Escape plays out. Milestones read them, and one
 * rule does: a bolder Escape needs the Gauge Escapes raise, Teflon, at its
 * `minTeflon`. Nothing else does: never the Power Map, a hidden risk or anyone's
 * belief.
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
  moves: readonly GaugeMove[],
): void {
  state.gaugesDue.push(...moves);
}

/**
 * An Escape was tried: the Gauge Escapes raise goes up as the month closes if it
 * worked, and down if it failed.
 */
export function gaugeFromEscape(
  state: State,
  content: Content,
  worked: boolean,
  note: string,
): void {
  const rules = content.escapes;
  if (!rules) return;
  const by = worked ? rules.by : rules.failed.by;
  state.gaugesDue.push({ gauge: rules.gauge, by, note });
}

/**
 * What an Escape with a minimum needs, while the Gauge Escapes raise is below it:
 * the Gauge's label, the level, and what the player has. Undefined if it can be played.
 */
export function gaugeNeeded(
  state: State,
  content: Content,
  min: number | undefined,
): { label: string; at: number; have: number } | undefined {
  const gauge = content.gauges?.find((g) => g.id === content.escapes?.gauge);
  if (min === undefined || !gauge) return undefined;
  const now = state.gauges[gauge.id] ?? gauge.start;
  return now < min ? { label: gauge.label, at: min, have: now } : undefined;
}

function clamp(gauge: Written, value: number): number {
  return Math.min(gauge.max, Math.max(gauge.min, value));
}

/** As the month closes, Gauges move, and any Milestone reached is told in the official story. */
export function closeGauges(state: State, content: Content): Landing | null {
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
