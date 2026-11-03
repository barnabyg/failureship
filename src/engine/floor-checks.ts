import type { Content } from "./content";
import { writtenMonths, type Scheduled } from "./floors";

interface Written {
  owner: string;
  item: Scheduled;
  kind: string;
}

/** Everything that can name a floor, and how a problem names it. */
function scheduledContent(content: Content): Written[] {
  const named = (
    kind: string,
    items: readonly (Scheduled & { id: string })[],
  ): Written[] =>
    items.map((item) => ({ owner: `${kind} "${item.id}"`, item, kind }));
  return [
    ...named("Scene", content.scenes),
    ...named("Notification", content.notifications),
    ...named("Demand", content.demands?.items ?? []),
    ...named("Move", content.moves),
    ...content.officialStory.entries.map((item) => ({
      owner: "An official story entry",
      item,
      kind: "Story",
    })),
  ];
}

/**
 * Each job has one floor, and a run starts the player on one. A floor's own
 * Scenes and Notifications cover every month it is written for, and its pool
 * covers a longer stay, so that no month on it comes up empty.
 */
export function findBrokenFloors(content: Content): string[] {
  const problems: string[] = [];
  const jobs = content.floors.map((f) => f.job);
  for (const job of new Set(jobs)) {
    if (jobs.filter((j) => j === job).length > 1) {
      problems.push(`Job "${job}" has more than one floor.`);
    }
  }
  if (!jobs.includes(content.you.job)) {
    problems.push(`The player starts at unknown job "${content.you.job}".`);
  }
  const scheduled = scheduledContent(content);
  for (const { owner, item, kind } of scheduled) {
    if (item.floor !== undefined && !jobs.includes(item.floor)) {
      problems.push(`${owner} is for unknown floor "${item.floor}".`);
    }
    if (!item.pool) continue;
    if (kind !== "Scene" && kind !== "Notification") {
      problems.push(`${owner} cannot be in a pool.`);
    }
    if (item.months) {
      problems.push(`${owner} is in a pool, so it cannot have months.`);
    }
    if (item.floor === undefined) {
      problems.push(`${owner} is in a pool, so it needs a floor.`);
    }
    const opened = content.actions.some(
      (a) => a.scene === item.id && a.months === undefined,
    );
    if (kind === "Scene" && !opened) {
      problems.push(
        `${owner} is in a pool, but no action without months opens it.`,
      );
    }
  }
  const run = content.balance.monthsPerRun;
  for (const job of new Set(jobs)) {
    const own = scheduled.filter(
      ({ item, kind }) =>
        item.floor === job &&
        ["Scene", "Notification", "Demand"].includes(kind),
    );
    const written = writtenMonths(content, job);
    for (let month = 1; month <= written; month++) {
      if (!own.some(({ item }) => item.months?.includes(month))) {
        problems.push(
          `Floor "${job}" has no Scene or Notification of its own for month ${String(month)}.`,
        );
      }
    }
    const pooled = own.some(({ item }) => item.pool);
    if (own.length === 0 && job !== content.you.job) {
      problems.push(`Floor "${job}" has no Scene or Notification of its own.`);
    } else if (own.length > 0 && written < run && !pooled) {
      problems.push(
        `Floor "${job}" is written for ${String(written)} months of a ${String(run)}-month run, so it needs a pool.`,
      );
    }
  }
  return problems;
}
