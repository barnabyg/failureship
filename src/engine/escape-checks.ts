import type { Bill, Condition, Content } from "./content";

type CheckCondition = (owner: string, condition: Condition) => void;
type CheckCharacter = (owner: string, written: string) => void;

/**
 * Which Bills must offer Escapes, and which must not: every hidden risk that
 * lands on the player, Grand Plan blame, and a Thread that backfires, which is
 * one that moves the Gauge Escapes raise down. A big mistake is past the point
 * of escape, except Grand Plan blame, and nothing that lands elsewhere offers any.
 */
function billsByNeed(content: Content) {
  const gauge = content.escapes?.gauge;
  const need: Bill[] = [];
  const none: Bill[] = [];
  const big = (bill: Bill) => bill.mistake !== undefined;
  for (const risk of content.risks) {
    (big(risk.onPlayer) ? none : need).push(risk.onPlayer);
    if (risk.onSomeoneElse) none.push(risk.onSomeoneElse);
  }
  for (const thread of content.threads) {
    for (const { bill, gauges } of thread.outcomes) {
      const backfires = gauges.some((g) => g.gauge === gauge && g.by < 0);
      (backfires && !big(bill) ? need : none).push(bill);
    }
  }
  for (const plan of content.grandPlans?.plans ?? []) {
    need.push(plan.failed.onPlayer);
    none.push(plan.failed.onSomeoneElse);
  }
  for (const report of content.changing?.whistleblower.reports ?? []) {
    none.push(report.bill);
  }
  return { need, none };
}

/**
 * A consequence of the player's bad behaviour offers ways out: Take it, last,
 * and at least one more. Each other way can fail, and failing is worse.
 */
export function findBrokenEscapes(
  content: Content,
  checkCondition: CheckCondition,
  checkCharacterOrPlace: CheckCharacter,
): string[] {
  const problems: string[] = [];
  const rules = content.escapes;
  const { need, none } = billsByNeed(content);
  const any = [...need, ...none].some((b) => b.escapes.length > 0);
  if (any && !rules)
    problems.push("Escapes are written, but no rules for them.");
  if (rules && !content.gauges?.some((g) => g.id === rules.gauge)) {
    problems.push(`Escapes raise unknown Gauge "${rules.gauge}".`);
  }
  if (rules && !rules.blamed.text.includes("{what}")) {
    problems.push("What someone blamed keeps needs to say {what}.");
  }
  for (const bill of none) {
    if (bill.escapes.length > 0) {
      problems.push(`Bill "${bill.id}" offers Escapes, but is past them.`);
    }
  }
  const ids = new Set<string>();
  // Content that writes no rules for Escapes has none to offer.
  for (const bill of rules ? need : []) {
    const owner = `Bill "${bill.id}"`;
    const { escapes } = bill;
    if (escapes.length < 2) {
      problems.push(`${owner} needs Escapes: Take it, and another way out.`);
    }
    const takes = escapes.filter((e) => e.kind === "take");
    if (takes.length !== 1 || escapes.at(-1)?.kind !== "take") {
      problems.push(`${owner} needs one Take it, as its last Escape.`);
    }
    for (const escape of escapes) {
      const at = `${owner} Escape "${escape.id}"`;
      if (ids.has(escape.id)) problems.push(`${at} uses an id already taken.`);
      ids.add(escape.id);
      if (escape.kind === "take") continue;
      if (escape.kind === "blame") checkCharacterOrPlace(at, escape.blames);
      if (escape.kind === "lie" && escape.seen) checkCondition(at, escape.seen);
      if (escape.fails) {
        checkCondition(at, escape.fails);
        if (escape.failed.why === undefined) {
          problems.push(`${at} can fail by "fails", so needs "failed.why".`);
        }
      }
      if (
        escape.kind === "bury" &&
        escape.fails === undefined &&
        escape.chance === undefined
      ) {
        problems.push(`${at} can never fail: it needs "fails" or "chance".`);
      }
      const { failed } = escape;
      const worse =
        failed.opinion < 0 ||
        failed.headOpinion < 0 ||
        failed.mistake !== undefined ||
        failed.remembers.some((r) => r.tone === "bad");
      if (!worse) {
        problems.push(`${at} needs to be worse than taking it when it fails.`);
      }
      if (failed.mistake !== undefined && bill.mistake !== undefined) {
        problems.push(`${at} fails into a second big mistake at once.`);
      }
      for (const effect of [escape.worked, failed]) {
        for (const memory of effect.remembers) {
          checkCharacterOrPlace(at, memory.character);
        }
      }
    }
  }
  return problems;
}
