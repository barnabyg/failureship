import { everyNotification, type Content } from "./content";
import { findNamedKinds } from "./consequence-checks";
import { holdersAtStart, resolveOn } from "./places";

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
    const to = resolveOn(holdersAtStart(content), item.to);
    if (!content.characters.some((c) => c.id === to)) {
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
    const over = resolveOn(holdersAtStart(content), item.word.over);
    if (!known.has(item.with)) {
      problems.push(`${owner} names unknown "${item.with}".`);
    }
    if (!known.has(over)) {
      problems.push(`${owner} names unknown "${item.word.over}".`);
    }
    if (item.with === over) {
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
