import {
  CLAIM_STATUSES,
  KINDS,
  behavioursOpenTo,
  everyBill,
  type Condition,
  type Content,
} from "./content";
import { castDealtFirst } from "./deal";
import { COMPETITOR } from "./rivals";

/** Showing or hiding an option on this would tell the player the truth. */
export function dependsOnHiddenTruth(
  condition: Condition,
  hiddenFlags: ReadonlySet<string> = new Set(),
): boolean {
  if ("flag" in condition) return hiddenFlags.has(condition.flag);
  if ("did" in condition) return hiddenFlags.has(condition.did);
  if (
    "believes" in condition ||
    "remembers" in condition ||
    "holderIs" in condition ||
    "bossIs" in condition ||
    "factNature" in condition ||
    "heardTrue" in condition
  ) {
    return true;
  }
  if ("not" in condition) {
    return dependsOnHiddenTruth(condition.not, hiddenFlags);
  }
  if ("all" in condition) {
    return condition.all.some((c) => dependsOnHiddenTruth(c, hiddenFlags));
  }
  if ("any" in condition) {
    return condition.any.some((c) => dependsOnHiddenTruth(c, hiddenFlags));
  }
  return false;
}

/** Flags that say which way something hidden went, so they carry the truth too. */
export function flagsSetByHiddenResults(content: Content): Set<string> {
  const options = content.scenes.flatMap((s) => s.options);
  // Who competes is read from the Org Chart, unless a competition waits on the truth.
  const competingHidden = (content.rivals?.competing ?? []).some(
    (c) => c.when !== undefined && dependsOnHiddenTruth(c.when),
  );
  return new Set([
    ...options
      .filter((o) =>
        o.results.some((r) => r.when && dependsOnHiddenTruth(r.when)),
      )
      .flatMap((o) => o.results.flatMap((r) => r.sets)),
    ...content.moves
      .filter(
        (m) =>
          (m.when && dependsOnHiddenTruth(m.when)) ||
          (m.by === COMPETITOR && competingHidden),
      )
      .flatMap((m) => m.sets),
    // Whether and how a Bill arrives is drawn, and can read the truth.
    ...everyBill(content).flatMap((b) => [
      ...b.sets,
      ...b.options.flatMap((o) => o.sets),
    ]),
    // Whether a Company Event lands is drawn too.
    ...content.events.flatMap((e) => e.sets),
    // Whether a Demand is forgotten or chased goes by the boss's kind.
    ...Object.values(content.demands?.sets ?? {}),
    // Whether the boss finds out goes by the boss's kind too.
    ...(content.overHead ? [content.overHead.sets.caught] : []),
    // Whether getting rid of the boss works goes by whoever protects them.
    ...(content.vacancies?.ousting?.sets ?? []),
  ]);
}

export function findBrokenDeal(
  content: Content,
  characters: ReadonlySet<string>,
): string[] {
  const { kinds, minPractitioners, charactersWithFact, facts } =
    content.hiddenTruth;
  const everyone = content.characters;
  const first = castDealtFirst(content);
  const problems: string[] = [];
  if (new Set(everyone.map((c) => c.name)).size < everyone.length) {
    problems.push("Two Characters share a name, which the charts cannot show.");
  }
  if (minPractitioners > first.length) {
    problems.push(
      `The deal wants ${String(minPractitioners)} Practitioners from ${String(first.length)} Characters.`,
    );
  }
  if (Object.values(kinds).every((k) => k.weight === 0)) {
    problems.push("The deal needs a kind with a weight above zero.");
  }
  // A later floor's cast has a fact as often as the first floor's does.
  if (charactersWithFact * 2 <= first.length) {
    problems.push("The deal must give most Characters a Hidden Fact.");
  }
  if (charactersWithFact > first.length) {
    problems.push("The deal wants more Hidden Facts than Characters.");
  }
  for (const fact of facts) {
    const owner = `Hidden Fact "${fact.id}"`;
    if (
      !fact.text.includes("{name}") ||
      fact.told?.includes("{name}") === false
    ) {
      problems.push(`${owner} needs to say {name}.`);
    }
    for (const [, token] of fact.text.matchAll(/\{(\w+)\}/g)) {
      if (token !== "name") {
        problems.push(`${owner} uses unknown token "{${token ?? ""}}".`);
      }
    }
    for (const c of fact.characters ?? []) {
      if (!characters.has(c)) {
        problems.push(`${owner} names unknown Character "${c}".`);
      }
    }
  }
  // With this many open to everyone, dealing can never run out, in any order.
  for (const { id: character } of everyone) {
    const open = facts.filter((f) => f.characters?.includes(character) ?? true);
    if (open.length < charactersWithFact) {
      problems.push(`Too few Hidden Facts can be dealt to "${character}".`);
    }
  }
  return problems;
}

function rolesOf(content: Content): Set<string> {
  return new Set(content.characters.flatMap((c) => c.role ?? []));
}

/** Signs must narrow the answer without ever settling it. */
export function findBrokenBehaviours(content: Content): string[] {
  const problems: string[] = [];
  const nameParts = content.characters.flatMap((c) => c.name.split(" "));
  for (const b of content.behaviours) {
    const owner = `Behaviour "${b.id}"`;
    for (const written of [b.text, b.clue ?? "{who}"]) {
      if (!written.includes("{who}")) {
        problems.push(`${owner} needs to say {who}.`);
      }
      for (const [, token] of written.matchAll(/\{(\w+)\}/g)) {
        if (token !== "who") {
          problems.push(`${owner} uses unknown token "{${token ?? ""}}".`);
        }
      }
    }
    const words = b.text.split(/\W+/);
    if (nameParts.some((part) => words.includes(part))) {
      problems.push(`${owner} names a Character, not a kind of person.`);
    }
    const likelihoods = Object.values(b.likelihood);
    if (likelihoods.filter((l) => l > 0).length < 2) {
      problems.push(`${owner} can come from only one kind.`);
    }
    if (new Set(likelihoods).size === 1) {
      problems.push(`${owner} gives no evidence: every kind is as likely.`);
    }
  }
  const roles = rolesOf(content);
  for (const b of content.behaviours) {
    for (const role of b.roles ?? []) {
      if (!roles.has(role)) {
        problems.push(`Behaviour "${b.id}" names unknown role "${role}".`);
      }
    }
  }
  for (const role of roles) {
    if (
      !content.behaviours.some(
        (b) => b.roles?.length === 1 && b.roles[0] === role,
      )
    ) {
      problems.push(`Role "${role}" has no behaviour of its own.`);
    }
  }
  if (content.behaviours.length > 0) {
    for (const character of content.characters) {
      const open = behavioursOpenTo(content, character.id);
      for (const kind of KINDS) {
        if (open.every((b) => b.likelihood[kind] === 0)) {
          problems.push(
            `Character "${character.id}" has no behaviour to show as a ${kind}.`,
          );
        }
      }
    }
  }
  return problems;
}

/** Lateness must be a clue about someone's kind, and never settle it. */
export function findBrokenInput(content: Content): string[] {
  const { input } = content.project;
  if (!input) return [];
  const problems: string[] = [];
  if (!content.characters.some((c) => c.id === input.character)) {
    problems.push(`The report's input names unknown "${input.character}".`);
  }
  const chances = Object.values(input.chance);
  if (chances.filter((c) => c > 0).length < 2) {
    problems.push("Late input can come from only one kind.");
  }
  if (new Set(chances).size === 1) {
    problems.push("Late input gives no evidence: every kind is as likely.");
  }
  if (chances.includes(1)) {
    problems.push(
      "Late input is certain from one kind, which would settle it.",
    );
  }
  return problems;
}

/** Sources must be worth weighing: never always right, and never always wrong. */
export function findBrokenSources(content: Content): string[] {
  const { methods, reliability, motives, claims, voices } = content.sources;
  const problems: string[] = [];
  const checkTokens = (owner: string, written: string, tokens: string[]) => {
    for (const [, token] of written.matchAll(/\{(\w+)\}/g)) {
      if (!tokens.includes(token ?? "")) {
        problems.push(`${owner} uses unknown token "{${token ?? ""}}".`);
      }
    }
  };
  for (const method of methods) {
    const owner = `Find Out method "${method.id}"`;
    for (const source of method.sources) {
      if (!content.characters.some((c) => c.id === source)) {
        problems.push(`${owner} names unknown Character "${source}".`);
      }
    }
    checkTokens(owner, method.prompt, method.someoneThere ? ["source"] : []);
    for (const frame of method.frames) {
      if (!frame.includes("{said}")) {
        problems.push(`${owner} has a frame that needs {said}: "${frame}"`);
      }
      checkTokens(owner, frame, ["said", "source"]);
    }
    if (Object.values(method.topics).every((t) => t === 0)) {
      problems.push(`${owner} has nothing to claim.`);
    }
  }
  const roles = rolesOf(content);
  for (const [role, spoken] of Object.entries(voices)) {
    const owner = `The voice of "${role}"`;
    if (!roles.has(role))
      problems.push(`A voice names unknown role "${role}".`);
    for (const line of spoken) {
      if (!line.includes("{said}")) {
        problems.push(`${owner} needs to say {said}: "${line}"`);
      }
      checkTokens(owner, line, ["said"]);
    }
  }
  for (const kind of KINDS) {
    for (const motive of motives) {
      const open = CLAIM_STATUSES.filter(
        (s) => reliability[kind][s] + motive.adjust[s] > 0,
      );
      if (open.length < 2) {
        problems.push(
          `A ${kind} with motive "${motive.id}" would always be read the same way.`,
        );
      }
    }
  }
  for (const motive of motives) {
    checkTokens(`Motive "${motive.id}"`, motive.text, ["name"]);
  }
  const pools = [
    ...KINDS.flatMap((k) => claims.kind[k]),
    ...claims.influence.high,
    ...claims.influence.low,
  ];
  for (const line of pools) {
    if (!line.includes("{subject}")) {
      problems.push(`A claim needs to say {subject}: "${line}"`);
    }
    checkTokens("A claim", line, ["subject"]);
  }
  for (const line of claims.fact) {
    if (!line.includes("{fact}")) {
      problems.push(`A claim about a fact needs to say {fact}: "${line}"`);
    }
    checkTokens("A claim", line, ["fact"]);
  }
  return problems;
}
