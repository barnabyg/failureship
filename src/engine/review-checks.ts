import type { Content, SceneData } from "./content";
import { dependsOnHiddenTruth } from "./truth-checks";

/** Whether anything a review can lead to goes on the record that Official standing reads. */
function movesStanding(content: Content, review: SceneData): boolean {
  const { standing } = content;
  if (!standing) return true;
  const deeds = new Set(standing.deeds.map((d) => d.flag));
  return review.options.some((o) =>
    o.results.some(
      (r) =>
        r.sets.some((flag) => deeds.has(flag)) ||
        r.project?.reported !== undefined,
    ),
  );
}

/** What one review must not be: set any other way, or more than paperwork. */
function findBrokenReview(
  content: Content,
  review: SceneData,
  hiddenFlags: ReadonlySet<string>,
): string[] {
  const owner = `Scene "${review.id}"`;
  const problems: string[] = [];
  const cannot = (what: string) =>
    problems.push(`${owner} is a review, so it cannot have ${what}.`);
  if (review.floor !== undefined) cannot("a floor");
  if (review.months !== undefined) cannot("months");
  if (review.pool) cannot("a pool");
  if (review.script !== undefined) cannot("a script");
  if (content.actions.some((a) => a.scene === review.id)) {
    problems.push(`${owner} is a review, so no action opens it.`);
  }
  if (content.project.flagged?.scene === review.id) {
    problems.push(
      `${owner} is a review, so the Project's flag cannot open it.`,
    );
  }
  for (const option of review.options) {
    const optionOwner = `${owner} option "${option.id}"`;
    for (const result of option.results) {
      // What a review says of the player is what the paperwork says.
      if (result.when && dependsOnHiddenTruth(result.when, hiddenFlags)) {
        problems.push(
          `${optionOwner} reads the hidden truth, which a review's results cannot.`,
        );
      }
      // A review never decides anything by itself.
      if (result.mistake !== undefined) {
        problems.push(
          `${optionOwner} is a big mistake, which a review cannot be.`,
        );
      }
    }
  }
  if (!movesStanding(content, review)) {
    problems.push(`${owner} is a review that never moves Official standing.`);
  }
  return problems;
}

/**
 * Each quarter of the run has one review of its own, so that each reads
 * differently, and a review is only ever a review.
 */
export function findBrokenReviews(
  content: Content,
  hiddenFlags: ReadonlySet<string>,
): string[] {
  const reviews = content.scenes.filter(
    (s): s is SceneData & { quarter: number } => s.quarter !== undefined,
  );
  const { monthsPerQuarter } = content.balance;
  const run = content.balance.monthsPerRun;
  const problems = reviews.flatMap((r) =>
    findBrokenReview(content, r, hiddenFlags),
  );
  if (monthsPerQuarter === undefined) {
    return [
      ...problems,
      ...reviews.map(
        (r) =>
          `Scene "${r.id}" is a review, but balance.json sets no monthsPerQuarter.`,
      ),
    ];
  }
  const quarters = Math.floor(run / monthsPerQuarter);
  for (const { id, quarter } of reviews) {
    if (quarter > quarters) {
      problems.push(
        `Scene "${id}" reviews quarter ${String(quarter)}, which a ${String(run)}-month run never reaches.`,
      );
    }
  }
  for (let quarter = 1; quarter <= quarters; quarter++) {
    const held = reviews.filter((r) => r.quarter === quarter).length;
    if (held === 0) {
      problems.push(`Quarter ${String(quarter)} of the run has no review.`);
    }
    if (held > 1) {
      problems.push(`Quarter ${String(quarter)} has more than one review.`);
    }
  }
  return problems;
}
