import type { Content } from "./content";
import { ownContent, writtenMonths, type Scheduled } from "./floors";

type Kind =
  | "Scene"
  | "Notification"
  | "Demand"
  | "Action"
  | "Move"
  | "Notebook event"
  | "Story entry"
  | "Project event"
  | "Project input";

interface Written {
  owner: string;
  item: Scheduled;
  kind: Kind;
}

/** Everything that can name a floor, and how a problem names it. */
function scheduledContent(content: Content): Written[] {
  const named = (
    kind: Kind,
    items: readonly (Scheduled & { id: string })[],
  ): Written[] =>
    items.map((item) => ({ owner: `${kind} "${item.id}"`, item, kind }));
  const unnamed = (
    kind: Kind,
    owner: string,
    items: readonly Scheduled[],
  ): Written[] => items.map((item) => ({ owner, item, kind }));
  const { input } = content.project;
  return [
    ...named("Scene", content.scenes),
    ...named("Notification", content.notifications),
    ...named("Demand", content.demands?.items ?? []),
    ...named("Action", content.actions),
    ...named("Move", content.moves),
    ...named("Notebook event", content.notebook.events),
    ...unnamed(
      "Story entry",
      "An official story entry",
      content.officialStory.entries,
    ),
    ...unnamed("Project event", "A Project event", content.project.events),
    ...unnamed("Project input", "The Project's input", input ? [input] : []),
  ];
}

/** Each room is keyed by its id, wherever it is in the tower. */
function findRepeatedRooms(content: Content): string[] {
  const rooms = content.floors.flatMap((f) => f.rooms.map((r) => r.id));
  return [...new Set(rooms)]
    .filter((id) => rooms.filter((r) => r === id).length > 1)
    .map((id) => `Room "${id}" appears more than once in the tower.`);
}

/** A pool Scene comes with an action to open it, in a room on its floor. */
function findUnopenedPool(content: Content, written: Written): string[] {
  const { owner, item, kind } = written;
  if (kind !== "Scene" || !item.pool) return [];
  const rooms = content.floors.find((f) => f.job === item.floor)?.rooms ?? [];
  const opened = content.actions.some(
    (a) =>
      a.scene === item.id &&
      a.months === undefined &&
      rooms.some((r) => r.id === a.place),
  );
  return opened
    ? []
    : [
        `${owner} is in a pool, but no action without months opens it in a room on its floor.`,
      ];
}

/**
 * Each job has one floor, and a run starts the player on one. Whatever is set
 * by month names its floor. A floor's own content covers every month it is
 * written for, and its pool covers a longer stay, so no month on it comes up empty.
 */
export function findBrokenFloors(content: Content): string[] {
  const problems: string[] = [];
  const jobs = content.floors.map((f) => f.job);
  if (!jobs.includes(content.you.job)) {
    problems.push(`The player starts at unknown job "${content.you.job}".`);
  }
  problems.push(...findRepeatedRooms(content));
  for (const written of scheduledContent(content)) {
    const { owner, item } = written;
    if (item.floor !== undefined && !jobs.includes(item.floor)) {
      problems.push(`${owner} is for unknown floor "${item.floor}".`);
    }
    if (item.months && item.floor === undefined) {
      problems.push(`${owner} has months, so it needs a floor.`);
    }
    if (item.pool && item.months) {
      problems.push(`${owner} is in a pool, so it cannot have months.`);
    }
    if (item.pool && item.floor === undefined) {
      problems.push(`${owner} is in a pool, so it needs a floor.`);
    }
    problems.push(...findUnopenedPool(content, written));
  }
  const run = content.balance.monthsPerRun;
  for (const job of new Set(jobs)) {
    if (jobs.filter((j) => j === job).length > 1) {
      problems.push(`Job "${job}" has more than one floor.`);
    }
    const own = ownContent(content, job);
    if (own.length === 0) {
      problems.push(
        `Floor "${job}" has no Scene, Notification or Demand of its own.`,
      );
      continue;
    }
    const months = writtenMonths(content, job);
    for (let month = 1; month <= months; month++) {
      if (!own.some((item) => item.months?.includes(month))) {
        problems.push(
          `Floor "${job}" has no Scene, Notification or Demand of its own for month ${String(month)}.`,
        );
      }
    }
    if (months < run && !own.some((item) => item.pool)) {
      problems.push(
        `Floor "${job}" is written for ${String(months)} months of a ${String(run)}-month run, so it needs a pool.`,
      );
    }
  }
  return problems;
}
