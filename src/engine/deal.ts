import type { Content, Kind } from "./content";
import { pick, pickWeighted, shuffle } from "./rng";

export interface DealtCharacter {
  id: string;
  kind: Kind;
  fact: { id: string; text: string } | null;
}

/**
 * The hidden truth of who really has influence over whom. Kept small for now:
 * who protects or owes whom can join it later as further lists of ties.
 */
export interface PowerMap {
  /** Everyone, most influential first. */
  order: string[];
  /** Each person after the first, with the one person who has influence over them. */
  influence: { who: string; over: string }[];
}

/** Each person, in a dealt order, comes under someone dealt before them. */
export function dealPowerMap(
  rng: number,
  content: Content,
): { powerMap: PowerMap; next: number } {
  const dealt = shuffle(
    rng,
    content.characters.map((c) => c.id),
  );
  const influence: PowerMap["influence"] = [];
  let next = dealt.next;
  dealt.items.slice(1).forEach((over, index) => {
    const above = pick(next, dealt.items.slice(0, index + 1));
    influence.push({ who: above.item, over });
    next = above.next;
  });
  return { powerMap: { order: dealt.items, influence }, next };
}

/** Deals every Character a kind, and most of them a Hidden Fact. */
export function dealCharacters(
  rng: number,
  content: Content,
): { characters: DealtCharacter[]; next: number } {
  const ids = content.characters.map((c) => c.id);
  const kinds = dealKinds(rng, ids, content);
  const facts = dealFacts(kinds.next, ids, content);
  return {
    characters: ids.map((id) => ({
      id,
      kind: kinds.dealt.get(id) ?? "believer",
      fact: facts.dealt.get(id) ?? null,
    })),
    next: facts.next,
  };
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
    const pick = pickWeighted(
      next,
      ["believer", "incompetent", "practitioner"] as const,
      (kind) => kinds[kind].weight,
    );
    dealt.set(id, pick.item);
    next = pick.next;
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
    const pick = pickWeighted(next, open, () => 1);
    used.add(pick.item.id);
    dealt.set(id, {
      id: pick.item.id,
      text: pick.item.text.replaceAll("{name}", nameOf(content, id)),
    });
    next = pick.next;
  }
  return { dealt, next };
}

function nameOf(content: Content, id: string): string {
  return content.characters.find((c) => c.id === id)?.name ?? id;
}
