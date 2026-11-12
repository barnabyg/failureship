import { findNamedKinds } from "./consequence-checks";
import {
  DEMAND_ANSWERS,
  KINDS,
  MOODS,
  everyBill,
  everyNotification,
  everyDemand,
  type Content,
} from "./content";
import { bossesAtStart, meantBy } from "./places";

/** The boss's signs must point somewhere without ever settling it. */
export function findBrokenBossSigns(content: Content): string[] {
  return findBrokenMoodSigns(content.boss.signs, "Boss sign");
}

/** A first trip over the boss's head must be a gamble, and no words may name a kind. */
export function findBrokenOverHead(content: Content): string[] {
  const { overHead: written } = content;
  if (!written) return [];
  const problems = findBrokenMoodSigns(written.signs, "Over-head sign");
  if (bossesAtStart(content).head === undefined) {
    problems.push(
      "Going over the boss's head needs your boss to answer to someone.",
    );
  }
  if (!content.actions.some((a) => a.overHead)) {
    problems.push("No action goes over the boss's head.");
  }
  const words = [
    ...KINDS.flatMap((kind) => {
      const { worked, failed } = written.outcomes[kind];
      return [
        ...worked.influential,
        ...worked.sidelined,
        ...failed,
        ...written.findsOut.reaction[kind],
      ];
    }),
    ...written.signs.map((s) => s.text),
    ...Object.values(written.verdict),
  ];
  problems.push(...findNamedKinds(content, "Going over the head", words));
  for (const [kind, { works }] of Object.entries(written.outcomes)) {
    for (const chance of Object.values(works)) {
      if (chance === 0 || chance === 1) {
        problems.push(`Going to a ${kind} must be able to go either way.`);
      }
    }
  }
  for (const [kind, chance] of Object.entries(written.findsOut.chance)) {
    if (chance === 0 || chance === 1) {
      problems.push(`A ${kind} boss must be able to find out, or not.`);
    }
  }
  return problems;
}

function findBrokenMoodSigns(
  signs: Content["boss"]["signs"],
  label: string,
): string[] {
  const problems: string[] = [];
  for (const sign of signs) {
    const owner = `${label} "${sign.id}"`;
    for (const [, token] of sign.text.matchAll(/\{(\w+)\}/g)) {
      problems.push(`${owner} uses unknown token "{${token ?? ""}}".`);
    }
    const likelihoods = Object.values(sign.likelihood);
    if (likelihoods.filter((l) => l > 0).length < 2) {
      problems.push(`${owner} can come from only one mood.`);
    }
    if (new Set(likelihoods).size === 1) {
      problems.push(`${owner} gives no evidence: every mood is as likely.`);
    }
  }
  if (signs.length > 0) {
    for (const mood of MOODS) {
      if (signs.every((s) => s.likelihood[mood] === 0)) {
        problems.push(`No boss sign can show a ${mood} mood.`);
      }
    }
  }
  return problems;
}

/** An approach must split the kinds, and its words must never name one. */
export function findBrokenApproaches(content: Content): string[] {
  const problems: string[] = [];
  for (const approach of content.boss.approaches) {
    const owner = `Approach "${approach.id}"`;
    if (new Set(Object.values(approach.shift)).size === 1) {
      problems.push(`${owner} is taken the same way by every kind.`);
    }
    const written = [
      ...Object.values(approach.reaction).flat(),
      ...Object.values(approach.overdone?.reaction ?? {}).flatMap(
        (l) => l ?? [],
      ),
    ];
    problems.push(...findNamedKinds(content, owner, written));
  }
  return problems;
}

/** A Demand must offer every answer, and stalling must be a real bet. */
export function findBrokenDemands(content: Content): string[] {
  const { demands } = content;
  if (!demands) return [];
  const problems: string[] = [];
  for (const [kind, { forgets, chases }] of Object.entries(demands.odds)) {
    if (forgets === 0 || chases === 0) {
      problems.push(`A ${kind} boss must be able to forget and to chase.`);
    }
    if (forgets + chases > 1) {
      problems.push(`A ${kind} boss's Demand odds add up to more than one.`);
    }
  }
  const { missed } = demands;
  if (missed) {
    if (missed.actions.length < content.balance.monthsPerRun) {
      problems.push("A missed meeting needs an action for every month.");
    }
    if (!content.actions.some((a) => a.sets.includes(missed.attended))) {
      problems.push(`No action sets "${missed.attended}".`);
    }
    if (!content.boss.approaches.some((a) => a.id === missed.approach)) {
      problems.push(`A missed meeting uses unknown "${missed.approach}".`);
    }
    const written = [
      ...missed.actions.flatMap((a) => [a.title, a.body, a.ask]),
      missed.forgotten.body,
      missed.chased.body,
    ];
    problems.push(...findNamedKinds(content, "A missed meeting", written));
  }
  for (const item of everyDemand(content)) {
    const owner = `Demand "${item.id}"`;
    const ids = item.options.map((o) => o.id);
    for (const answer of DEMAND_ANSWERS) {
      if (!ids.includes(answer)) problems.push(`${owner} needs "${answer}".`);
    }
    for (const option of item.options) {
      if (option.stalls !== (option.id === "stall")) {
        problems.push(`${owner} must stall on "stall", and only there.`);
      }
    }
    const answerable = item.chased.options.some(
      (o) => (content.balance.actionCosts[o.cost ?? ""] ?? 0) === 0,
    );
    if (!answerable) {
      problems.push(`${owner}'s chaser needs an answer that costs nothing.`);
    }
  }
  return problems;
}

/** No sign may settle what someone believes, and news must start from someone. */
export function findBrokenReputation(
  content: Content,
  characters: ReadonlySet<string>,
): string[] {
  const written = content.reputation;
  const problems = written
    ? findBrokenMoodSigns(
        written.signs.map((s) => ({
          ...s,
          text: s.text.replaceAll("{who}", ""),
        })),
        "Reputation sign",
      )
    : [];
  const outcomes = [
    ...content.scenes.flatMap((s) => s.options.flatMap((o) => o.results)),
    ...everyNotification(content).flatMap((n) =>
      n.options.flatMap((o) => [o, ...(o.bet ? [o.bet.lost] : [])]),
    ),
    ...everyBill(content),
  ];
  const bosses = bossesAtStart(content);
  for (const outcome of outcomes) {
    if (!outcome.news) continue;
    if (!written) {
      problems.push("News is written, but no reputation for it to reach.");
    }
    for (const character of outcome.news.at) {
      const id = meantBy(bosses, character);
      if (id === undefined || !characters.has(id)) {
        problems.push(`News names unknown Character "${character}".`);
      }
    }
  }
  return problems;
}
