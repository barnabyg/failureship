import { KINDS, type Content, type Kind } from "./content";
import { couldCompeteAtStart } from "./rivals";
import { draw, drawFor, pick, pickWeighted, shuffle } from "./rng";

export interface DealtCharacter {
  id: string;
  kind: Kind;
  fact: { id: string; text: string } | null;
  /** What they want, which colours what they tell the player. */
  motive: string;
}

/** Who stands for the player in a tie, such as a favour owed. */
export const YOU = "you";

/** The hidden truth of who really has influence over whom, and who owes whom. */
export interface PowerMap {
  /** Everyone, most influential first. */
  order: string[];
  /** Each person after the first, with the one person who has influence over them. */
  influence: { who: string; over: string }[];
  /** Favours owed. Either side can be the player, `YOU`. */
  favours: { owes: string; to: string; why: string }[];
}

/**
 * Whether someone's word counts with someone else: they are above them on the
 * Power Map, or are owed a favour by them.
 */
export function hasSway(map: PowerMap, who: string, over: string): boolean {
  if (map.favours.some((f) => f.owes === over && f.to === who)) return true;
  const seen = new Set<string>();
  let above = map.influence.find((i) => i.over === over)?.who;
  while (above !== undefined && !seen.has(above)) {
    if (above === who) return true;
    seen.add(above);
    const next = above;
    above = map.influence.find((i) => i.over === next)?.who;
  }
  return false;
}

/**
 * The first floor's cast, who are dealt together. A Character written for a
 * later floor's cast is dealt after them, by draws of their own, so that adding
 * one leaves every deal of the floors below alone.
 */
export function castDealtFirst(content: Content): string[] {
  return content.characters
    .filter((c) => c.floor === undefined || c.floor === content.you.job)
    .map((c) => c.id);
}

/**
 * Each Character of a later floor's cast, dealt by draws named for them: a kind
 * by the usual weights, a Hidden Fact as often as the first cast has one, and a
 * motive. They join the Power Map below its most influential, since they are new
 * to the people there, under someone already on it.
 */
export function dealNewcomers(
  seed: number,
  characters: readonly DealtCharacter[],
  powerMap: PowerMap,
  content: Content,
): { characters: DealtCharacter[]; powerMap: PowerMap } {
  const { kinds, facts, charactersWithFact } = content.hiddenTruth;
  const first = castDealtFirst(content);
  const dealt = [...characters];
  let map = powerMap;
  for (const { id } of content.characters.filter(
    (c) => !first.includes(c.id),
  )) {
    const at = (name: string) => drawFor(seed, `newcomer-${name}:${id}`, 0);
    const kind = pickWeighted(
      Math.floor(at("kind") * 2 ** 32),
      KINDS,
      (k) => kinds[k].weight,
    ).item;
    const used = new Set(dealt.flatMap((c) => (c.fact ? [c.fact.id] : [])));
    const open = facts.filter(
      (f) => !used.has(f.id) && (f.characters?.includes(id) ?? true),
    );
    const written =
      at("has-fact") < charactersWithFact / first.length
        ? open[Math.floor(at("fact") * open.length)]
        : undefined;
    const motive =
      content.sources.motives[
        Math.floor(at("motive") * content.sources.motives.length)
      ];
    dealt.push({
      id,
      kind,
      fact: written
        ? {
            id: written.id,
            text: written.text.replaceAll("{name}", nameOf(content, id)),
          }
        : null,
      motive: motive?.id ?? "",
    });
    const { order, influence } = map;
    const lowest = Math.min(
      Math.max(1, content.sources.influentialCount),
      order.length,
    );
    const index =
      lowest + Math.floor(at("place") * (order.length - lowest + 1));
    const above = order[Math.floor(at("above") * index)];
    if (above === undefined) continue;
    map = {
      ...map,
      order: [...order.slice(0, index), id, ...order.slice(index)],
      influence: [...influence, { who: above, over: id }],
    };
  }
  return { characters: dealt, powerMap: map };
}

/** Favours already owed between Characters, by named draws, so the rest of a deal stands. */
export function dealFavours(
  seed: number,
  map: PowerMap,
  content: Content,
): PowerMap {
  const written = content.deals?.favours;
  if (!written) return map;
  const favours: PowerMap["favours"] = [];
  const ids = castDealtFirst(content);
  for (let i = 0; i < written.dealt; i++) {
    const at = (name: string, items: readonly string[]) =>
      items[
        Math.floor(
          drawFor(seed, `favour-${name}:${String(i)}`, 0) * items.length,
        )
      ];
    const owes = at("owes", ids);
    const to = at(
      "to",
      ids.filter((id) => id !== owes),
    );
    const why = at("why", written.why);
    if (owes === undefined || to === undefined || why === undefined) continue;
    if (favours.some((f) => f.owes === owes && f.to === to)) continue;
    favours.push({ owes, to, why });
  }
  return { ...map, favours };
}

/** Whether someone is among the few at the top of the Power Map. */
export function isInfluential(
  powerMap: PowerMap,
  content: Content,
  id: string,
): boolean {
  return powerMap.order.indexOf(id) < content.sources.influentialCount;
}

/** Each person, in a dealt order, comes under someone dealt before them. */
export function dealPowerMap(
  rng: number,
  content: Content,
): { powerMap: PowerMap; next: number } {
  const dealt = shuffle(rng, castDealtFirst(content));
  const influence: PowerMap["influence"] = [];
  let next = dealt.next;
  dealt.items.slice(1).forEach((over, index) => {
    const above = pick(next, dealt.items.slice(0, index + 1));
    influence.push({ who: above.item, over });
    next = above.next;
  });
  return { powerMap: { order: dealt.items, influence, favours: [] }, next };
}

/** Deals every Character a kind, and most of them a Hidden Fact. */
export function dealCharacters(
  rng: number,
  content: Content,
): { characters: DealtCharacter[]; next: number } {
  const ids = castDealtFirst(content);
  const kinds = dealKindsWithRivals(rng, ids, content);
  const facts = dealFacts(kinds.next, ids, content);
  return {
    characters: ids.map((id) => ({
      id,
      kind: kinds.dealt.get(id) ?? "believer",
      fact: facts.dealt.get(id) ?? null,
      motive: "",
    })),
    next: facts.next,
  };
}

/** Dealt last, so that adding motives leaves the rest of a seed's deal alone. */
export function dealMotives(
  rng: number,
  characters: readonly DealtCharacter[],
  content: Content,
): { characters: DealtCharacter[]; next: number } {
  let next = rng;
  const dealt = characters.map((character) => {
    const motive = pick(next, content.sources.motives);
    next = motive.next;
    return { ...character, motive: motive.item.id };
  });
  return { characters: dealt, next };
}

/**
 * Kinds, dealt again some of the time if nobody who could compete with the
 * player is a Practitioner, so that a run with no Rival is rare. Dealing again
 * leans every role the same way, so no role's kind is a tell.
 */
function dealKindsWithRivals(
  rng: number,
  ids: readonly string[],
  content: Content,
) {
  const first = dealKinds(rng, ids, content);
  if (!content.rivals) return first;
  const could = couldCompeteAtStart(content);
  const rivalled = could.some((id) => first.dealt.get(id) === "practitioner");
  const roll = draw(first.next);
  if (rivalled || roll.value >= content.rivals.dealAgain) {
    return { ...first, next: roll.next };
  }
  return dealKinds(roll.next, ids, content);
}

/** The first seats go to Practitioners, so there is always something to find. */
function dealKinds(rng: number, ids: readonly string[], content: Content) {
  const { kinds, minPractitioners } = content.hiddenTruth;
  const seats = shuffle(rng, ids);
  const dealt = new Map<string, Kind>();
  let next = seats.next;
  seats.items.forEach((id, seat) => {
    if (seat < minPractitioners) {
      dealt.set(id, "practitioner");
      return;
    }
    const kind = pickWeighted(
      next,
      ["believer", "incompetent", "practitioner"] as const,
      (k) => kinds[k].weight,
    );
    dealt.set(id, kind.item);
    next = kind.next;
  });
  return { dealt, next };
}

function dealFacts(rng: number, ids: readonly string[], content: Content) {
  const { facts, charactersWithFact } = content.hiddenTruth;
  const seats = shuffle(rng, ids);
  const dealt = new Map<string, { id: string; text: string }>();
  const used = new Set<string>();
  let next = seats.next;
  for (const id of seats.items.slice(0, charactersWithFact)) {
    const open = facts.filter(
      (f) => !used.has(f.id) && (f.characters?.includes(id) ?? true),
    );
    const fact = pick(next, open);
    used.add(fact.item.id);
    dealt.set(id, {
      id: fact.item.id,
      text: fact.item.text.replaceAll("{name}", nameOf(content, id)),
    });
    next = fact.next;
  }
  return { dealt, next };
}

function nameOf(content: Content, id: string): string {
  return content.characters.find((c) => c.id === id)?.name ?? id;
}

/** Someone leaves, and whoever answered to them answers to whoever was above them. */
export function leaveMap(map: PowerMap, id: string): PowerMap {
  const lowered = lowerOnMap(map, id);
  const above = lowered.influence.find((i) => i.over === id)?.who;
  return {
    ...lowered,
    order: lowered.order.filter((o) => o !== id),
    influence: lowered.influence
      .filter((i) => i.over !== id)
      .map((i) =>
        i.who === id && above !== undefined ? { who: above, over: i.over } : i,
      ),
  };
}

/** Someone goes to the top, and whoever was there now answers to them. */
export function raiseOnMap(map: PowerMap, id: string): PowerMap {
  const [top] = map.order;
  if (top === id || top === undefined) return map;
  return {
    ...map,
    order: [id, ...map.order.filter((o) => o !== id)],
    influence: [
      { who: id, over: top },
      ...map.influence.filter((i) => i.over !== id),
    ],
  };
}

/** Someone goes to the bottom, and whoever answered to them moves up a level. */
export function lowerOnMap(map: PowerMap, id: string): PowerMap {
  const order = [...map.order.filter((o) => o !== id), id];
  const [top] = order;
  if (top === undefined || top === id) return map;
  // Someone at the very top has no one above them, so the next person takes over.
  const above = map.influence.find((i) => i.over === id)?.who ?? top;
  return {
    ...map,
    order,
    influence: [
      ...map.influence
        .filter((i) => i.over !== id && i.over !== top)
        .map((i) => (i.who === id ? { who: above, over: i.over } : i)),
      { who: above, over: id },
    ],
  };
}
