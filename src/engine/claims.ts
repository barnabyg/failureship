import {
  CLAIM_STATUSES,
  KINDS,
  type ClaimStatus,
  type ClueVerdict,
  type Content,
} from "./content";
import type { DealtCharacter, PowerMap } from "./deal";
import { pick, pickWeighted } from "./rng";

/** What a source told the player. Its status stays hidden until the run ends. */
export interface Claim {
  month: number;
  source: string;
  subject: string;
  /** The Hidden Fact it passes on, if that is what it says. */
  factId: string | null;
  text: string;
  status: ClaimStatus;
}

type Method = Content["sources"]["methods"][number];

interface ClaimRequest {
  month: number;
  method: Method;
  source: string;
  subject: string;
  characters: readonly DealtCharacter[];
  powerMap: PowerMap;
}

/** How likely this source is to give each status: who they are and what they want. */
function reliabilityOf(
  content: Content,
  source: DealtCharacter,
): Record<ClaimStatus, number> {
  const { reliability, motives } = content.sources;
  const motive = motives.find((m) => m.id === source.motive);
  const base = reliability[source.kind];
  return Object.fromEntries(
    CLAIM_STATUSES.map((status) => [
      status,
      Math.max(0, base[status] + (motive?.adjust[status] ?? 0)),
    ]),
  ) as Record<ClaimStatus, number>;
}

/** A Hidden Fact the subject does not have, for a claim that is not true. */
function factsNotOf(content: Content, subject: DealtCharacter) {
  return content.hiddenTruth.facts.filter(
    (f) =>
      f.id !== subject.fact?.id && (f.characters?.includes(subject.id) ?? true),
  );
}

/** What the results screen says this claim was worth. */
export function verdictOfClaim(content: Content, claim: Claim): ClueVerdict {
  if (claim.status !== "true") return "wrong";
  const fact = content.hiddenTruth.facts.find((f) => f.id === claim.factId);
  return fact?.nature === "idle" ? "idle" : "held";
}

export function makeClaim(
  rng: number,
  content: Content,
  request: ClaimRequest,
): { claim: Claim; next: number } {
  const { method, characters, powerMap } = request;
  const source = characters.find((c) => c.id === request.source);
  const subject = characters.find((c) => c.id === request.subject);
  if (!source || !subject) throw new Error("A claim needs two Characters.");
  const { claims } = content.sources;
  const name =
    content.characters.find((c) => c.id === subject.id)?.name ?? subject.id;

  const statuses = reliabilityOf(content, source);
  const status = pickWeighted(rng, CLAIM_STATUSES, (s) => statuses[s]);
  const topic = pickWeighted(
    status.next,
    ["kind", "influence", "fact"] as const,
    (t) => method.topics[t],
  );
  const isTrue = status.item === "true";
  let next = topic.next;

  const write = (pool: readonly string[]) => {
    const line = pick(next, pool);
    next = line.next;
    return line.item.replaceAll("{subject}", name);
  };

  const fact = (() => {
    if (topic.item !== "fact") return null;
    if (isTrue) {
      const dealt = content.hiddenTruth.facts.find(
        (f) => f.id === subject.fact?.id,
      );
      return dealt ?? null;
    }
    const open = factsNotOf(content, subject);
    if (open.length === 0) return null;
    const chosen = pick(next, open);
    next = chosen.next;
    return chosen.item;
  })();

  let text: string;
  if (fact) {
    text = write(claims.fact).replaceAll(
      "{fact}",
      (fact.told ?? fact.text).replaceAll("{name}", name),
    );
  } else if (topic.item === "influence") {
    const high =
      powerMap.order.indexOf(subject.id) < content.sources.influentialCount;
    text = write(claims.influence[high === isTrue ? "high" : "low"]);
  } else {
    let said = subject.kind;
    if (!isTrue) {
      const other = pick(
        next,
        KINDS.filter((k) => k !== subject.kind),
      );
      next = other.next;
      said = other.item;
    }
    text = write(claims.kind[said]);
  }

  const frame = pick(next, method.frames);
  next = frame.next;
  const sourceName =
    content.characters.find((c) => c.id === source.id)?.name ?? source.id;

  return {
    claim: {
      month: request.month,
      source: source.id,
      subject: subject.id,
      factId: fact?.id ?? null,
      text: frame.item
        .replaceAll("{source}", sourceName)
        .replaceAll("{said}", text),
      status: status.item,
    },
    next,
  };
}
