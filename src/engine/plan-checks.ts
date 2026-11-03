import {
  KINDS,
  PLAN_HOWS,
  everyNotification,
  type Condition,
  type Content,
} from "./content";
import { findNamedKinds } from "./consequence-checks";
import { dependsOnHiddenTruth } from "./truth-checks";

type CheckCondition = (owner: string, condition: Condition) => void;

/**
 * Grand Plans: each can be completed both in reality and in appearance, by what
 * the player did and never by the hidden truth, and only in appearance does it add
 * a hidden risk. How a boss takes it, and whether they count it done, must go by
 * their kind, through signs that never name one. Whoever takes one on must have
 * several months to do it in. A way that needs someone falls back on another,
 * which must put the same on the official record, since who has what is dealt.
 */
export function findBrokenPlans(
  content: Content,
  hiddenFlags: ReadonlySet<string>,
  checkCondition: CheckCondition,
): string[] {
  const written = content.grandPlans;
  if (!written) return [];
  const problems: string[] = [];
  const heardIn = new Set([
    ...content.scenes.map((s) => s.id),
    ...everyNotification(content).map((n) => n.id),
  ]);
  const floors = new Set(content.floors.map((f) => f.job));
  const characters = new Set(content.characters.map((c) => c.id));
  const ids = new Set<string>();
  for (const plan of written.plans) {
    const owner = `Grand Plan "${plan.id}"`;
    if (ids.has(plan.id)) problems.push(`${owner} is written twice.`);
    ids.add(plan.id);
    if (plan.floor !== undefined && !floors.has(plan.floor)) {
      problems.push(`${owner} is on unknown floor "${plan.floor}".`);
    }
    if (plan.lasts < 2 || plan.lasts > content.balance.monthsPerRun) {
      problems.push(
        `${owner} lasts ${String(plan.lasts)} months, which must be several and within the run.`,
      );
    }
    for (const where of plan.heardIn) {
      if (!heardIn.has(where)) {
        problems.push(`${owner} is heard of in unknown "${where}".`);
      }
    }
    for (const how of PLAN_HOWS) {
      if (!plan.ways.some((w) => w.how === how)) {
        problems.push(`${owner} needs a way to complete it in ${how}.`);
      }
    }
    for (const kind of KINDS) {
      if (!plan.ways.some((w) => w.counts.includes(kind))) {
        problems.push(`${owner} has no way that a ${kind} boss counts done.`);
      }
    }
    if (plan.ways.every((w) => w.counts.length === KINDS.length)) {
      problems.push(`${owner} is counted done alike by every kind of boss.`);
    }
    const { blame, onPlayer, onSomeoneElse } = plan.failed;
    if (blame.sticks) checkCondition(owner, blame.sticks);
    // A Plan can fail after the player has moved on from its boss.
    for (const bill of [onPlayer, onSomeoneElse]) {
      if (/\{(boss|head)\}/.test(`${bill.from ?? ""} ${bill.body}`)) {
        problems.push(
          `${owner}'s Bill "${bill.id}" names a place, which may no longer be its boss's.`,
        );
      }
    }
    for (const need of plan.needs?.from ?? []) {
      if (!characters.has(need.character)) {
        problems.push(`${owner} needs unknown Character "${need.character}".`);
      }
    }
    if (plan.needs && !plan.needs.told.includes("{who}")) {
      problems.push(`${owner}'s needs must say {who} on the results screen.`);
    }
    problems.push(
      ...findBrokenWays(content, plan, hiddenFlags, checkCondition),
    );
  }
  return problems;
}

function findBrokenWays(
  content: Content,
  plan: NonNullable<Content["grandPlans"]>["plans"][number],
  hiddenFlags: ReadonlySet<string>,
  checkCondition: CheckCondition,
): string[] {
  const problems: string[] = [];
  const owner = `Grand Plan "${plan.id}"`;
  const risky = new Set(content.risks.map((r) => r.addedBy));
  const deeds = new Set(content.standing?.deeds.map((d) => d.flag));
  const onRecord = (sets: readonly string[]) =>
    sets
      .filter((f) => deeds.has(f))
      .sort()
      .join();
  const wayIds = new Set<string>();
  for (const way of plan.ways) {
    const wayOwner = `${owner} way "${way.id}"`;
    if (wayIds.has(way.id)) problems.push(`${wayOwner} is written twice.`);
    wayIds.add(way.id);
    if (way.when) {
      checkCondition(wayOwner, way.when);
      if (dependsOnHiddenTruth(way.when, hiddenFlags)) {
        problems.push(`${wayOwner} reads the hidden truth.`);
      }
    } else if (!plan.ways.some((w) => w.otherwise === way.id)) {
      problems.push(`${wayOwner} has no "when", and nothing falls back on it.`);
    }
    if (KINDS.every((k) => way.belief[k] === way.belief.believer)) {
      problems.push(`${wayOwner} is taken alike by every kind of boss.`);
    }
    problems.push(
      ...findNamedKinds(content, wayOwner, Object.values(way.reaction)),
    );
    const addsRisk = way.sets.some((flag) => risky.has(flag));
    if (way.how === "appearance" && !addsRisk) {
      problems.push(
        `${wayOwner} is completed in appearance, so it must add a hidden risk.`,
      );
    }
    if (way.how === "reality" && addsRisk) {
      problems.push(
        `${wayOwner} is completed in reality, and cannot add a hidden risk.`,
      );
    }
    if (way.needs && !plan.needs) {
      problems.push(`${wayOwner} needs something, but the Plan needs nothing.`);
    }
    if (way.needs !== (way.otherwise !== undefined)) {
      problems.push(
        `${wayOwner} needs something exactly when it has an "otherwise".`,
      );
    }
    const instead = plan.ways.find((w) => w.id === way.otherwise);
    if (way.otherwise !== undefined && instead?.how !== "appearance") {
      problems.push(
        `${wayOwner} falls back on "${way.otherwise}", which must be a way in appearance.`,
      );
    }
    if (instead && onRecord(instead.sets) !== onRecord(way.sets)) {
      problems.push(
        `${wayOwner} and "${instead.id}" must put the same on the official record.`,
      );
    }
  }
  return problems;
}
