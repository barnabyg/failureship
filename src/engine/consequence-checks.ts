import {
  everyBill,
  everyDemand,
  everyNotification,
  type Content,
} from "./content";

/** Every flag anything can set, which is all that a Thread can start from. */
function flagsThatCanBeSet(content: Content): Set<string> {
  const notifications = everyNotification(content);
  return new Set([
    ...content.actions.flatMap((a) => a.sets),
    ...notifications.flatMap((n) =>
      n.options.flatMap((o) => [...o.sets, ...(o.bet?.lost.sets ?? [])]),
    ),
    ...content.scenes.flatMap((s) =>
      s.options.flatMap((o) => o.results.flatMap((r) => r.sets)),
    ),
    ...content.moves.flatMap((m) => m.sets),
    ...everyBill(content).flatMap((b) => b.sets),
    ...Object.values(content.demands?.sets ?? {}),
    ...(content.demands?.missed?.sets ?? []),
    ...Object.values(content.overHead?.sets ?? {}),
    ...(content.project.input ? [content.project.input.sets] : []),
  ]);
}

/** A Bill must be able to reach the player, in the way it says it does. */
function findBrokenBills(content: Content): string[] {
  const problems: string[] = [];
  const taken = new Set([
    ...content.notifications.map((n) => n.id),
    ...everyDemand(content).map((d) => d.id),
    ...content.moves.map((m) => m.id),
  ]);
  for (const bill of everyBill(content)) {
    const owner = `Bill "${bill.id}"`;
    if (taken.has(bill.id)) problems.push(`${owner} uses an id already taken.`);
    taken.add(bill.id);
    if (bill.as !== "notice" && bill.from === undefined) {
      problems.push(`${owner} needs "from", to say who it comes through.`);
    }
    if (bill.as === "notification") {
      const free = bill.options.some(
        (o) => (content.balance.actionCosts[o.cost ?? ""] ?? 0) === 0,
      );
      if (!free) problems.push(`${owner} needs an answer that costs nothing.`);
    } else if (bill.options.length > 0) {
      problems.push(`${owner} has options, so must be a notification.`);
    }
  }
  return problems;
}

/** A Thread has to start from something the player can do, and be able to end. */
export function findBrokenThreads(content: Content): string[] {
  const problems = findBrokenBills(content);
  const flags = flagsThatCanBeSet(content);
  const ids = new Set<string>();
  for (const thread of content.threads) {
    const owner = `Thread "${thread.id}"`;
    if (ids.has(thread.id)) problems.push(`${owner} is written twice.`);
    ids.add(thread.id);
    if (!flags.has(thread.startedBy)) {
      problems.push(
        `${owner} starts from "${thread.startedBy}", set by nothing.`,
      );
    }
    if (thread.after.min > thread.after.max) {
      problems.push(`${owner} comes back after a shorter wait than it starts.`);
    }
  }
  return problems;
}
