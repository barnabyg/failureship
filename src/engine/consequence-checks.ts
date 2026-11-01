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
    ...content.events.flatMap((e) => e.sets),
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

/** An event must have a way to land, and must leave the player's bosses alone. */
export function findBrokenEvents(content: Content): string[] {
  const problems: string[] = [];
  const known = new Set(content.characters.map((c) => c.id));
  const bosses = [content.boss.character, content.overHead?.character];
  const ids = new Set<string>();
  const fromRisks = new Set(content.risks.flatMap((r) => r.event ?? []));
  for (const event of content.events) {
    const owner = `Company Event "${event.id}"`;
    if (ids.has(event.id)) problems.push(`${owner} is written twice.`);
    ids.add(event.id);
    const ways = [event.schedule, event.disaster || undefined].filter(
      (way) => way !== undefined,
    );
    if (ways.length + Number(fromRisks.has(event.id)) !== 1) {
      problems.push(
        `${owner} needs one way to land: a schedule, a disaster or a risk.`,
      );
    }
    for (const month of event.schedule?.months ?? []) {
      if (month > content.balance.monthsPerRun) {
        problems.push(
          `${owner} is set in month ${String(month)}, past the run.`,
        );
      }
    }
    const { reports, rises, falls } = event.reshuffle;
    for (const { character, to } of reports) {
      // Vacancies, and a change of boss, wait for the next phase.
      if (bosses.includes(character)) {
        problems.push(`${owner} moves "${character}", who has to stay put.`);
      }
      for (const id of [character, to]) {
        if (!known.has(id)) problems.push(`${owner} names unknown "${id}".`);
      }
    }
    for (const id of [...rises, ...falls]) {
      if (!known.has(id)) problems.push(`${owner} names unknown "${id}".`);
    }
    const moved = reports.length + rises.length + falls.length > 0;
    if (moved !== (event.changed !== undefined)) {
      problems.push(
        `${owner} needs "changed" if and only if it moves anyone on the charts.`,
      );
    }
  }
  // A surprise is never a big mistake by itself, even by way of what it starts.
  const fromDisasters = new Set(
    content.events.filter((e) => e.disaster).flatMap((e) => e.sets),
  );
  for (const thread of content.threads) {
    if (
      fromDisasters.has(thread.startedBy) &&
      thread.outcomes.some((o) => o.bill.mistake !== undefined)
    ) {
      problems.push(`A disaster starts Thread "${thread.id}", a big mistake.`);
    }
  }
  for (const risk of content.risks) {
    if (
      fromDisasters.has(risk.addedBy) &&
      risk.onPlayer.mistake !== undefined
    ) {
      problems.push(`A disaster adds risk "${risk.id}", a big mistake.`);
    }
  }
  for (const id of fromRisks) {
    if (!ids.has(id))
      problems.push(`A risk names unknown Company Event "${id}".`);
  }
  if (
    content.balance.disasterChance > 0 &&
    !content.events.some((e) => e.disaster)
  ) {
    problems.push("A disaster has a chance, but no disaster is written.");
  }
  return problems;
}

/** A risk has to come from something, and go through someone who is there. */
export function findBrokenRisks(content: Content): string[] {
  const problems: string[] = [];
  const flags = flagsThatCanBeSet(content);
  const ids = new Set<string>();
  for (const risk of content.risks) {
    const owner = `Risk "${risk.id}"`;
    if (ids.has(risk.id)) problems.push(`${owner} is written twice.`);
    ids.add(risk.id);
    if (!flags.has(risk.addedBy)) {
      problems.push(`${owner} comes from "${risk.addedBy}", set by nothing.`);
    }
    if (risk.after.min > risk.after.max) {
      problems.push(`${owner} comes out after a shorter wait than it starts.`);
    }
    if (!content.characters.some((c) => c.id === risk.route.character)) {
      problems.push(`${owner} goes through unknown "${risk.route.character}".`);
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
