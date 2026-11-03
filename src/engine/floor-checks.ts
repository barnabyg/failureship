import type { Content } from "./content";

/** Each job has one floor, and a run starts the player in one of them. */
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
  return problems;
}
