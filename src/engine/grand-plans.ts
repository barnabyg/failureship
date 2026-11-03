import { sendBill } from "./bills";
import type { Content, GrandPlan } from "./content";
import { isOn } from "./floors";
import { applyOutcome } from "./outcome";
import { bossOf } from "./places";
import { bossKindOf, matches, moodOf, personOf, shiftBelief } from "./reads";
import { remember } from "./reputation";
import { drawFor } from "./rng";
import type { PlanHow, State, TakenPlan } from "./state";
import type { PlayerView, StepView } from "./view";

function writtenPlan(content: Content, id: string): GrandPlan | undefined {
  return content.grandPlans?.plans.find((p) => p.id === id);
}

/**
 * The Grand Plan of whoever is the player's boss now, if they have taken one on.
 * A Plan belongs to its boss, so a new boss brings a new one.
 */
function planNow(state: State, content: Content): TakenPlan | undefined {
  const boss = bossOf(state, content);
  return state.plans.findLast((p) => p.boss === boss);
}

/** Whether this is the boss's Plan now, and still to be done: what `planRunning` reads. */
export function isPlanRunning(
  state: State,
  content: Content,
  id: string,
): boolean {
  const taken = planNow(state, content);
  return taken?.id === id && taken.ended === null;
}

/**
 * Whether a boss's Grand Plan was completed, and how: really done, or made to
 * look done. Left out, the boss is whoever is the player's boss now. This is the
 * read for anything that follows from a Plan being completed, such as the boss
 * moving up. Null if they have none, it is still running, or it failed.
 */
export function planCompleted(
  state: State,
  content: Content,
  boss: string = bossOf(state, content),
): { id: string; how: PlanHow; month: number } | null {
  const taken = state.plans.findLast((p) => p.boss === boss);
  const ended = taken?.ended;
  if (!taken || !ended || ended.how === "failed") return null;
  return { id: taken.id, how: ended.how, month: ended.month };
}

/**
 * As each month opens: the boss's Plan fails if it is past due, and a boss with
 * no Plan takes on the first written for the player's floor that nobody has had.
 */
export function followPlans(state: State, content: Content): void {
  const written = content.grandPlans;
  if (!written) return;
  const taken = planNow(state, content);
  if (taken?.ended === null && taken.due < state.month) {
    failPlan(state, content, taken);
  }
  if (taken) return;
  const next = written.plans.find(
    (p) => isOn(state, content, p) && !state.plans.some((t) => t.id === p.id),
  );
  if (!next) return;
  state.plans.push({
    id: next.id,
    boss: bossOf(state, content),
    month: state.month,
    due: state.month + next.lasts - 1,
    heard: null,
    ended: null,
  });
}

/**
 * Not done in time, the Plan fails, and the boss looks for someone to blame. If
 * it can stick to the player, it lands on them at a seeded chance by the boss's
 * kind and how they stand with them.
 */
function failPlan(state: State, content: Content, taken: TakenPlan): void {
  const plan = writtenPlan(content, taken.id);
  if (!plan) return;
  taken.ended = { month: state.month, how: "failed", way: null };
  taken.heard ??= state.month;
  const { blame, onPlayer, onSomeoneElse } = plan.failed;
  const chance =
    blame.chance[bossKindOf(state, content)] +
    blame.mood[moodOf(state, content)];
  const blamed =
    matches(state, content, blame.sticks) &&
    drawFor(state.seed, `plan-blame:${plan.id}`, state.month) < chance;
  sendBill(state, content, blamed ? onPlayer : onSomeoneElse);
}

/** The player hears of the boss's Plan here, if this is where it is told. */
export function hearOfPlan(state: State, content: Content, id: string): void {
  const taken = planNow(state, content);
  const plan = taken && writtenPlan(content, taken.id);
  if (taken?.heard === null && plan?.heardIn.includes(id)) {
    taken.heard = state.month;
  }
}

/**
 * Completes the boss's Plan the first way whose `when` now holds. The official
 * record is the same whatever the boss's kind, while what it does to their belief
 * goes by their kind, and the player sees only the sign of that.
 */
export function completePlans(state: State, content: Content): void {
  const taken = planNow(state, content);
  if (taken?.ended !== null) return;
  const way = writtenPlan(content, taken.id)?.ways.find((w) =>
    matches(state, content, w.when),
  );
  if (!way) return;
  taken.ended = { month: state.month, how: way.how, way: way.id };
  taken.heard ??= state.month;
  applyOutcome(state, content, { sets: way.sets }, way.done.title);
  const kind = bossKindOf(state, content);
  const shift = way.belief[kind];
  shiftBelief(state, taken.boss, shift);
  state.bossLandings.push({
    month: state.month,
    boss: taken.boss,
    choice: way.done.title,
    shift,
  });
  if (shift !== 0) {
    remember(state, content, {
      character: taken.boss,
      about: "impression",
      text: way.done.title,
    });
  }
  state.noticesDue.push({ ...way.done, reaction: way.reaction[kind] });
}

/** The boss's Plan, once the player has heard of it, and where it has got to. */
export function planInView(
  state: State,
  content: Content,
): PlayerView["grandPlan"] {
  const written = content.grandPlans;
  const taken = planNow(state, content);
  const plan = taken && writtenPlan(content, taken.id);
  if (!written || !plan || taken.heard === null) return null;
  const { statuses } = written;
  const { ended } = taken;
  const status =
    ended === null
      ? statuses.running.replaceAll("{month}", String(taken.due))
      : ended.how === "failed"
        ? statuses.failed
        : statuses.completed;
  return { title: plan.title, what: plan.what, status };
}

/** Each boss's Plan, and what really became of it. */
export function plansInResults(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }>["grandPlans"] {
  return state.plans.flatMap((taken) => {
    const plan = writtenPlan(content, taken.id);
    if (!plan) return [];
    const { name, title } = personOf(state, content, taken.boss);
    return [
      {
        month: taken.month,
        name,
        title,
        plan: plan.title,
        fate: plan.results[taken.ended?.how ?? "running"],
      },
    ];
  });
}
