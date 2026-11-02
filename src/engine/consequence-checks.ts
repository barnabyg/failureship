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

/** A line that names a kind would hand the player the hidden truth. */
export function findNamedKinds(
  content: Content,
  owner: string,
  written: readonly string[],
): string[] {
  const labels = Object.values(content.hiddenTruth.kinds).map((k) =>
    k.label.toLowerCase(),
  );
  return written
    .filter((line) => labels.some((l) => line.toLowerCase().includes(l)))
    .map((line) => `${owner} names a kind: "${line}"`);
}

/**
 * What falls due must always be answerable and must say how it ends, so a month
 * can never get stuck on a commitment and none can be left neither kept nor broken.
 */
function findBrokenDue(
  content: Content,
  owner: string,
  due: Pick<ReturnType<typeof everyNotification>[number], "options">,
): string[] {
  const problems: string[] = [];
  const free = (o: { cost?: string | undefined }) =>
    (content.balance.actionCosts[o.cost ?? ""] ?? 0) === 0;
  if (!due.options.some((o) => free(o) && o.settles === "broken")) {
    problems.push(`${owner} needs a free way to break it.`);
  }
  for (const option of due.options) {
    if (option.settles === undefined) {
      problems.push(`${owner} option "${option.id}" must say how it settles.`);
    }
    if (option.bet && option.bet.lost.settles === undefined) {
      problems.push(
        `${owner} option "${option.id}" must say how losing settles.`,
      );
    }
  }
  return problems;
}

/** A Promise has to be offered somewhere, to someone who exists, in no kind's name. */
export function findBrokenPromises(content: Content): string[] {
  const written = content.promises;
  const problems: string[] = [];
  const options = [
    ...everyNotification(content).flatMap((n) => n.options),
    ...content.scenes.flatMap((s) => s.options),
  ];
  const offered = new Set(options.flatMap((o) => o.promise ?? []));
  for (const id of offered) {
    if (!written?.items.some((item) => item.id === id)) {
      problems.push(`A choice offers unknown Promise "${id}".`);
    }
  }
  const dues = new Set(
    [...(written?.items ?? []), ...(content.deals?.items ?? [])].flatMap(
      (item) => item.due.options.map((o) => o.id),
    ),
  );
  for (const option of everyNotification(content).flatMap((n) => n.options)) {
    if (option.settles !== undefined && !dues.has(option.id)) {
      problems.push(`Option "${option.id}" settles nothing that falls due.`);
    }
  }
  if (!written) return problems;
  for (const item of written.items) {
    const owner = `Promise "${item.id}"`;
    if (!content.characters.some((c) => c.id === item.to)) {
      problems.push(`${owner} is made to unknown "${item.to}".`);
    }
    if (!offered.has(item.id)) {
      problems.push(`${owner} is offered by nothing.`);
    }
    if (item.after.min > item.after.max) {
      problems.push(`${owner} falls due after a shorter wait than it starts.`);
    }
    problems.push(...findBrokenDue(content, owner, item.due));
  }
  for (const option of content.notifications.flatMap((n) => n.options)) {
    if (option.promise !== undefined && option.result) {
      problems.push(
        `Option "${option.id}" has a result, but what is said back is its result.`,
      );
    }
  }
  const { replies } = written;
  problems.push(
    ...findNamedKinds(content, "A reply to a Promise", [
      ...Object.values(replies.believed).flat(),
      ...Object.values(replies.doubted).flat(),
      ...replies.letDown,
      ...replies.heard,
    ]),
  );
  return problems;
}

/** A Deal has to be offered, between people who exist, and end either way. */
export function findBrokenDeals(content: Content): string[] {
  const written = content.deals;
  const problems: string[] = [];
  const options = [
    ...everyNotification(content).flatMap((n) => n.options),
    ...content.scenes.flatMap((s) => s.options),
  ];
  const offered = new Set(options.flatMap((o) => o.deal ?? []));
  for (const id of offered) {
    if (!written?.items.some((item) => item.id === id)) {
      problems.push(`A choice offers unknown Deal "${id}".`);
    }
  }
  if (!written) return problems;
  if (!content.promises) {
    problems.push("Deals are written, but no Promises to break like them.");
  }
  const known = new Set(content.characters.map((c) => c.id));
  const promised = new Set(content.promises?.items.map((p) => p.id));
  for (const item of written.items) {
    const owner = `Deal "${item.id}"`;
    if (promised.has(item.id)) problems.push(`${owner} shares a Promise's id.`);
    for (const id of [item.with, item.word.over]) {
      if (!known.has(id)) problems.push(`${owner} names unknown "${id}".`);
    }
    if (item.with === item.word.over) {
      problems.push(`${owner} has someone put in a word with themselves.`);
    }
    if (!offered.has(item.id)) problems.push(`${owner} is offered by nothing.`);
    for (const span of [item.after, item.word.after]) {
      if (span.min > span.max) {
        problems.push(
          `${owner} falls due after a shorter wait than it starts.`,
        );
      }
    }
    problems.push(...findBrokenDue(content, owner, item.due));
  }
  for (const option of content.notifications.flatMap((n) => n.options)) {
    if (option.deal !== undefined && option.result) {
      problems.push(
        `Option "${option.id}" has a result, but what is said back is its result.`,
      );
    }
  }
  return problems;
}

/** Only Believers change, and both of the player's bosses stay, until vacancies exist. */
export function findBrokenChanging(content: Content): string[] {
  const written = content.changing;
  if (!written) return [];
  const problems: string[] = [];
  const known = new Set(content.characters.map((c) => c.id));
  const bosses = [content.boss.character, content.overHead?.character];
  for (const id of Object.keys(written.leaving)) {
    if (!known.has(id)) problems.push(`Leaving names unknown "${id}".`);
    if (bosses.includes(id)) {
      problems.push(`"${id}" cannot leave: nothing creates a vacancy yet.`);
    }
  }
  for (const burn of written.burns) {
    const { practitioner, whistleblower, left } = burn.leans;
    if (practitioner + whistleblower + left === 0) {
      problems.push(`Burn "${burn.about}" leans nobody any way.`);
    }
  }
  for (const sign of written.whistleblower.signs) {
    if (!sign.text.includes("{who}")) {
      problems.push(`Whistleblower sign "${sign.id}" needs to say {who}.`);
    }
    if (content.behaviours.some((b) => b.id === sign.id)) {
      problems.push(`Whistleblower sign "${sign.id}" shares a behaviour's id.`);
    }
  }
  if (!written.whistleblower.motive.includes("{who}")) {
    problems.push("A whistleblower's motive needs to say {who}.");
  }
  if (written.whistleblower.reports.at(-1)?.when !== undefined) {
    problems.push(
      'A whistleblower needs a report with no "when", to fall back on.',
    );
  }
  return problems;
}

/** A Gauge must be reachable by its Milestones, and moved by Threads that name it. */
export function findBrokenGauges(content: Content): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const gauge of content.gauges ?? []) {
    const owner = `Gauge "${gauge.id}"`;
    if (ids.has(gauge.id)) problems.push(`${owner} is written twice.`);
    ids.add(gauge.id);
    if (gauge.start < gauge.min || gauge.start > gauge.max) {
      problems.push(`${owner} starts outside its range.`);
    }
    for (const milestone of gauge.milestones) {
      if (milestone.at <= gauge.start || milestone.at > gauge.max) {
        problems.push(
          `${owner} has Milestone "${milestone.title}" out of reach.`,
        );
      }
    }
  }
  for (const thread of content.threads) {
    for (const move of thread.outcomes.flatMap((o) => o.gauges)) {
      if (!ids.has(move.gauge)) {
        problems.push(
          `Thread "${thread.id}" moves unknown Gauge "${move.gauge}".`,
        );
      }
    }
  }
  return problems;
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
