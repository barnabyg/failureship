import {
  chasedIdOf,
  everyBill,
  everyDemand,
  everyNotification,
  type Content,
} from "./content";
import { YOU } from "./deal";
import { bossesAtStart, meantBy } from "./places";
import { flagsSetByHiddenResults } from "./truth-checks";

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

/** Only Believers change, and both of the player's bosses stay, until vacancies exist. */
export function findBrokenChanging(content: Content): string[] {
  const written = content.changing;
  if (!written) return [];
  const problems: string[] = [];
  const known = new Set(content.characters.map((c) => c.id));
  const { boss, head } = bossesAtStart(content);
  const bosses = [boss, head];
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

/**
 * Official standing must read only the official record, so each flag it names is
 * set by the player's own choices in plain view, and never by a hidden result.
 * Whether a Demand is chased goes by the boss's kind, so a chase's answers do not
 * count, though they can set a flag that the Demand's own answers set too.
 */
export function findBrokenStanding(content: Content): string[] {
  const written = content.standing;
  if (!written) return [];
  const problems: string[] = [];
  const hidden = flagsSetByHiddenResults(content);
  const chases = new Set(everyDemand(content).map((d) => chasedIdOf(d.id)));
  const chosen = new Set([
    ...content.actions.flatMap((a) => a.sets),
    ...everyNotification(content)
      .filter((n) => !chases.has(n.id))
      .flatMap((n) => n.options.flatMap((o) => o.sets)),
    ...content.scenes.flatMap((s) =>
      s.options.flatMap((o) => o.results.flatMap((r) => r.sets)),
    ),
  ]);
  for (const { flag } of written.deeds) {
    if (!chosen.has(flag) || hidden.has(flag)) {
      problems.push(
        `Official standing reads "${flag}", which no choice of the player's sets in plain view.`,
      );
    }
  }
  const statuses = content.project.statuses.map((s) => s.id);
  for (const status of statuses) {
    if (!(status in written.reported)) {
      problems.push(
        `Official standing says nothing of reported status "${status}".`,
      );
    }
  }
  for (const status of Object.keys(written.reported)) {
    if (!statuses.includes(status)) {
      problems.push(`Official standing names unknown status "${status}".`);
    }
  }
  const starts = written.bands.map((b) => b.from);
  if (
    starts[0] !== 0 ||
    starts.some((from, i) => i > 0 && from <= (starts[i - 1] ?? 0))
  ) {
    problems.push(
      "Official standing's bands must start at 0 and go up from there.",
    );
  }
  if (starts.length > 1 && written.finalWarning >= (starts[1] ?? 0)) {
    problems.push(
      "Official standing on a Final Warning must be within its first band.",
    );
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
  const { boss, head } = bossesAtStart(content);
  // Moving the player would change their boss as surely as moving the boss.
  const staying = [YOU, boss, ...(head === undefined ? [] : [head])];
  const who = (written: string) => meantBy({ boss, head }, written);
  const isKnown = (written: string) => known.has(who(written) ?? "");
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
      if (staying.includes(who(character) ?? "")) {
        problems.push(`${owner} moves "${character}", who has to stay put.`);
      } else if (!isKnown(character)) {
        problems.push(`${owner} names unknown "${character}".`);
      }
      if (!isKnown(to)) {
        problems.push(`${owner} names unknown "${to}".`);
      }
    }
    for (const id of [...rises, ...falls]) {
      if (!isKnown(id)) {
        problems.push(`${owner} names unknown "${id}".`);
      }
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

/** A catastrophe has to be fair: words for it, and a warning before the choice. */
export function findBrokenMistakes(content: Content): string[] {
  const problems: string[] = [];
  const options = [
    ...everyNotification(content).flatMap((n) =>
      n.options.map((o) => ({
        owner: `Notification "${n.id}" option "${o.id}"`,
        stakes: o.stakes,
        outcomes: [o, ...(o.bet ? [o.bet.lost] : [])],
      })),
    ),
    ...content.scenes.flatMap((s) =>
      s.options.map((o) => ({
        owner: `Scene "${s.id}" option "${o.id}"`,
        stakes: o.stakes,
        outcomes: o.results,
      })),
    ),
  ];
  for (const { owner, stakes, outcomes } of options) {
    const catastrophic = outcomes.some((o) => o.mistake === "catastrophic");
    if (catastrophic && stakes === undefined) {
      problems.push(`${owner} is catastrophic, with no stakes to signal it.`);
    }
    if (!catastrophic && stakes !== undefined) {
      problems.push(`${owner} signals stakes it does not have.`);
    }
  }
  const anyMistake =
    options.some((o) => o.outcomes.some((x) => x.mistake !== undefined)) ||
    content.moves.some((m) => m.mistake !== undefined) ||
    everyBill(content).some((b) => b.mistake !== undefined) ||
    content.actions.some((a) => a.mistake !== undefined);
  if (anyMistake && !content.mistakes) {
    problems.push("A big mistake is written, but no words for one.");
  }
  for (const a of content.actions) {
    if (a.mistake !== undefined && a.result === undefined) {
      problems.push(`Action "${a.id}" is a big mistake, so needs a result.`);
    }
  }
  return problems;
}
