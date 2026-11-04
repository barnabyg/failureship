import { sendBill } from "./bills";
import { noteLanding } from "./boss";
import type { Content, GrandPlan, PlanHow } from "./content";
import { isOn } from "./floors";
import { applyOutcome } from "./outcome";
import { bossOf } from "./places";
import {
  isGone,
  isMovingUp,
  kindOf,
  matches,
  moodOfCharacter,
  personOf,
  shiftBelief,
} from "./reads";
import { drawFor } from "./rng";
import { calledBy, sayPeople } from "./say";
import type { State, TakenPlan } from "./state";
import type { PlayerView, StepView } from "./view";

type Way = GrandPlan["ways"][number];

function writtenPlan(content: Content, id: string): GrandPlan | undefined {
  return content.grandPlans?.plans.find((p) => p.id === id);
}

/**
 * The latest Grand Plan of whoever is the player's boss now, if they have taken
 * one on. A Plan belongs to its boss, so a new boss brings a new one.
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
 * Whether a boss's latest Grand Plan was completed: how, really done or made to
 * look done, and whether that boss counted it done, which goes by their kind.
 * Left out, the boss is whoever is the player's boss now. This is the read for
 * anything that follows from a Plan being completed, such as the boss moving up.
 * Null if they have none, it is still running, or it failed.
 */
export function planCompleted(
  state: State,
  content: Content,
  boss: string = bossOf(state, content),
): { id: string; how: PlanHow; month: number; counted: boolean } | null {
  const taken = state.plans.findLast((p) => p.boss === boss);
  const ended = taken?.ended;
  if (!taken || !ended || ended.how === "failed") return null;
  const { month, how, counted } = ended;
  return { id: taken.id, how, month, counted };
}

/**
 * As each month opens: every Plan past due fails, whoever's it is, and a boss
 * whose last Plan has ended takes on the next written for the player's floor
 * that they have not had and nobody else is running. Each boss has one at a time.
 */
export function followPlans(state: State, content: Content): void {
  const written = content.grandPlans;
  if (!written) return;
  for (const taken of state.plans) {
    if (taken.ended === null && taken.due < state.month) {
      failPlan(state, content, taken);
    }
  }
  const boss = bossOf(state, content);
  // A boss on their way up takes on nothing new.
  if (planNow(state, content)?.ended === null || isMovingUp(state, boss)) {
    return;
  }
  const next = written.plans.find(
    (p) =>
      isOn(state, content, p) &&
      !state.plans.some(
        (t) => t.id === p.id && (t.boss === boss || t.ended === null),
      ),
  );
  if (!next) return;
  state.plans.push({
    id: next.id,
    boss,
    month: state.month,
    due: state.month + next.lasts - 1,
    heard: null,
    keeper: keeperFor(state, next),
    ended: null,
  });
}

/** Who really has what the Plan needs, dealt from the seed among those still here. */
function keeperFor(state: State, plan: GrandPlan): string | null {
  const from = (plan.needs?.from ?? []).filter(
    (n) => !isGone(state, n.character),
  );
  const value = drawFor(state.seed, `plan-keeper:${plan.id}`, state.month);
  return from[Math.floor(value * from.length)]?.character ?? null;
}

/**
 * Not done in time, the Plan fails, and its boss looks for someone to blame,
 * even if the player has since moved away from them. If it can stick to the
 * player, it lands on them at a seeded chance by that boss's kind and how they
 * stand with the player.
 */
function failPlan(state: State, content: Content, taken: TakenPlan): void {
  const plan = writtenPlan(content, taken.id);
  if (!plan) return;
  taken.ended = {
    month: state.month,
    how: "failed",
    way: null,
    counted: false,
  };
  taken.heard ??= state.month;
  const { blame, onPlayer, onSomeoneElse } = plan.failed;
  const chance =
    blame.chance[kindOf(state, taken.boss)] +
    blame.mood[moodOfCharacter(state, content, taken.boss)];
  const blamed =
    !isGone(state, taken.boss) &&
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
 * The run as a Plan's ways read it: only what the player did while it ran, so
 * that what was done for an earlier Plan never completes a later one.
 */
function whileRunning(state: State, taken: TakenPlan): State {
  return { ...state, deeds: state.deeds.filter((d) => d.month >= taken.month) };
}

/** Whether the player has asked whoever really has what the Plan needs. */
function hasWhatItNeeds(state: State, plan: GrandPlan, taken: TakenPlan) {
  const asked = plan.needs?.from.find((n) => n.character === taken.keeper);
  return (
    asked !== undefined &&
    whileRunning(state, taken).deeds.some((d) => d.flag === asked.asked)
  );
}

/**
 * Completes each Plan still in time the first way whose `when` now holds, or,
 * without what that way needs, the way it falls back on. The official record is
 * the same whatever the boss's kind, while their belief, and whether they count
 * it done, go by it, and the player sees only the sign of that.
 */
export function completePlans(state: State, content: Content): void {
  for (const taken of state.plans) {
    const plan = writtenPlan(content, taken.id);
    if (!plan || taken.ended !== null || taken.due < state.month) continue;
    const chosen = plan.ways.find(
      (w) =>
        w.when !== undefined &&
        matches(whileRunning(state, taken), content, w.when),
    );
    if (!chosen) continue;
    const way =
      chosen.needs && !hasWhatItNeeds(state, plan, taken)
        ? plan.ways.find((w) => w.id === chosen.otherwise)
        : chosen;
    if (way) complete(state, content, taken, way);
  }
}

function complete(
  state: State,
  content: Content,
  taken: TakenPlan,
  way: Way,
): void {
  const kind = kindOf(state, taken.boss);
  taken.ended = {
    month: state.month,
    how: way.how,
    way: way.id,
    counted: way.counts.includes(kind),
  };
  taken.heard ??= state.month;
  applyOutcome(state, content, { sets: way.sets }, way.done.title);
  const shift = way.belief[kind];
  shiftBelief(state, taken.boss, shift);
  noteLanding(state, content, taken.boss, shift, way.done.title);
  // A Plan followed to its end after the player moved away is a former boss's.
  const former = taken.boss !== bossOf(state, content);
  const title = former ? content.grandPlans?.formerBoss : undefined;
  state.noticesDue.push({
    ...way.done,
    title: title ?? way.done.title,
    reaction: way.reaction[kind],
  });
}

/**
 * What text can say of the boss's Plan now: `{plan}`, its title, and `{keeper}`,
 * whoever really has what it needs.
 */
export function planWords(
  state: State,
  content: Content,
): Record<string, string> {
  const taken = planNow(state, content);
  const plan = taken && writtenPlan(content, taken.id);
  return {
    "{plan}": plan?.title ?? "",
    "{keeper}":
      taken === undefined || taken.keeper === null
        ? ""
        : calledBy(state, content, taken.keeper),
  };
}

/** The boss's Plan, once the player has heard of it, and where it has got to. */
export function planInView(
  state: State,
  content: Content,
): PlayerView["grandPlan"] {
  const written = content.grandPlans;
  const boss = bossOf(state, content);
  // A Plan just taken on is not in view until heard of, so the last one stays.
  const taken = state.plans.findLast(
    (p) => p.boss === boss && p.heard !== null,
  );
  const plan = taken && writtenPlan(content, taken.id);
  if (!written || !plan) return null;
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

/** Each boss's Plan, what really became of it, and who had what it needed. */
export function plansInResults(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }>["grandPlans"] {
  return state.plans.flatMap((taken) => {
    const plan = writtenPlan(content, taken.id);
    if (!plan) return [];
    const { name, title } = personOf(state, content, taken.boss);
    const keeper =
      plan.needs && taken.keeper !== null
        ? sayPeople(plan.needs.told, {
            "{who}": calledBy(state, content, taken.keeper),
          })
        : null;
    return [
      {
        month: taken.month,
        name,
        title,
        plan: plan.title,
        fate: plan.results[taken.ended?.how ?? "running"],
        keeper,
      },
    ];
  });
}
