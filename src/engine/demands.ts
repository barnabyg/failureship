import { chasedIdOf, everyDemand, type Content } from "./content";
import { applyOutcome } from "./outcome";
import { actionsThisMonth, bossKindOf } from "./reads";
import { drawFor } from "./rng";
import type { State, Step } from "./state";

/** A stalled Demand gets a seeded draw each later month: forgotten, chased or neither. */
export function followUpDemands(state: State, content: Content): void {
  const { demands } = content;
  if (!demands) return;
  const kind = bossKindOf(state, content);
  const { forgets, chases } = demands.odds[kind];
  for (const open of [...state.openDemands]) {
    const item = everyDemand(content).find((d) => d.id === open.id);
    if (!item || open.chased) continue;
    if (open.due) {
      open.due = false;
      // After what belongs to this month, and ahead of what recurs.
      const recurring = state.unanswered.findIndex((id) =>
        content.notifications.some((n) => n.id === id && !n.months),
      );
      state.unanswered.splice(
        recurring < 0 ? state.unanswered.length : recurring,
        0,
        open.id,
      );
      continue;
    }
    const value = drawFor(state.seed, `demand:${open.id}`, state.month);
    if (value < forgets) {
      state.openDemands = state.openDemands.filter((d) => d !== open);
      state.noticesDue.push(item.forgotten);
      applyOutcome(
        state,
        content,
        { sets: [demands.sets.forgotten] },
        item.forgotten.title,
      );
    } else if (value < forgets + chases) {
      open.chased = true;
      state.unanswered.unshift(chasedIdOf(open.id));
      applyOutcome(
        state,
        content,
        { sets: [demands.sets.chased], opinion: demands.chasedPenalty[kind] },
        item.chased.subject,
      );
    }
  }
}

/** A meeting the player missed gives them an action, and the boss notices. */
export function dealWithAbsence(state: State, content: Content): Step | null {
  const missed = content.demands?.missed;
  if (!missed || state.absenceDealtWith) return null;
  state.absenceDealtWith = true;
  const hadMeeting = actionsThisMonth(state, content).some((a) =>
    a.sets.includes(missed.attended),
  );
  if (!hadMeeting || state.flags.includes(missed.attended)) return null;
  // With no action left to go, it was not a decision, and it must not spiral.
  if (state.visited.length === 0) return null;
  const unused = missed.actions.filter(
    (a) => !state.actionsGiven.includes(a.id),
  );
  const index = drawFor(state.seed, "minutes", state.month) * unused.length;
  const action = unused[Math.floor(index)];
  if (!action) return null;
  state.actionsGiven.push(action.id);
  state.openDemands.push({
    id: action.id,
    month: state.month,
    chased: false,
    due: true,
  });
  const reaction = applyOutcome(
    state,
    content,
    { sets: missed.sets, approach: missed.approach },
    action.title,
  );
  return { kind: "notice", title: action.title, body: action.body, reaction };
}
