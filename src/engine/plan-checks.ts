import { KINDS, PLAN_HOWS, everyNotification, type Content } from "./content";
import { findNamedKinds } from "./consequence-checks";
import { dependsOnHiddenTruth } from "./truth-checks";

/**
 * Grand Plans: each can be completed both in reality and in appearance, by what
 * the player did and never by the hidden truth, and only in appearance does it add
 * a hidden risk. How a boss takes it must go by their kind, through signs that
 * never name one. Whoever takes one on must have several months to do it in.
 */
export function findBrokenPlans(
  content: Content,
  hiddenFlags: ReadonlySet<string>,
): string[] {
  const written = content.grandPlans;
  if (!written) return [];
  const problems: string[] = [];
  const heardIn = new Set([
    ...content.scenes.map((s) => s.id),
    ...everyNotification(content).map((n) => n.id),
  ]);
  const risky = new Set(content.risks.map((r) => r.addedBy));
  const floors = new Set(content.floors.map((f) => f.job));
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
    const wayIds = new Set<string>();
    for (const way of plan.ways) {
      const wayOwner = `${owner} way "${way.id}"`;
      if (wayIds.has(way.id)) problems.push(`${wayOwner} is written twice.`);
      wayIds.add(way.id);
      if (dependsOnHiddenTruth(way.when, hiddenFlags)) {
        problems.push(`${wayOwner} reads the hidden truth.`);
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
    }
  }
  return problems;
}
