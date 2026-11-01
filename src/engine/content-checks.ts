import { z } from "zod";
import {
  CLAIM_STATUSES,
  DEMAND_ANSWERS,
  KINDS,
  MOODS,
  behavioursOpenTo,
  contentSchema,
  everyDemand,
  everyNotification,
  type Condition,
  type Content,
  type SceneData,
} from "./content";

type SceneResult = SceneData["options"][number]["results"][number];

/** Thrown when a data file breaks the content format, naming what is wrong. */
export class ContentError extends Error {
  override name = "ContentError";
}

/** Checks hand-written content, so that a typo fails loudly at start-up. */
export function parseContent(raw: unknown): Content {
  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ContentError(z.prettifyError(parsed.error));
  }
  const content = parsed.data;
  const problems = findBrokenReferences(content);
  if (problems.length > 0) throw new ContentError(problems.join("\n"));
  return content;
}

/** Showing or hiding an option on this would tell the player the truth. */
function dependsOnHiddenTruth(
  condition: Condition,
  hiddenFlags: ReadonlySet<string> = new Set(),
): boolean {
  if ("flag" in condition) return hiddenFlags.has(condition.flag);
  if (
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
  return false;
}

/** Flags that say which way something hidden went, so they carry the truth too. */
function flagsSetByHiddenResults(content: Content): Set<string> {
  const options = content.scenes.flatMap((s) => s.options);
  return new Set([
    ...options
      .filter((o) =>
        o.results.some((r) => r.when && dependsOnHiddenTruth(r.when)),
      )
      .flatMap((o) => o.results.flatMap((r) => r.sets)),
    ...content.moves
      .filter((m) => m.when && dependsOnHiddenTruth(m.when))
      .flatMap((m) => m.sets),
    // Whether a Demand is forgotten or chased goes by the boss's kind.
    ...Object.values(content.demands?.sets ?? {}),
    // Whether the boss finds out goes by the boss's kind too.
    ...(content.overHead ? [content.overHead.sets.caught] : []),
  ]);
}

function findBrokenDeal(
  content: Content,
  characters: ReadonlySet<string>,
): string[] {
  const { kinds, minPractitioners, charactersWithFact, facts } =
    content.hiddenTruth;
  const everyone = content.characters;
  const problems: string[] = [];
  if (new Set(everyone.map((c) => c.name)).size < everyone.length) {
    problems.push("Two Characters share a name, which the charts cannot show.");
  }
  if (minPractitioners > everyone.length) {
    problems.push(
      `The deal wants ${String(minPractitioners)} Practitioners from ${String(everyone.length)} Characters.`,
    );
  }
  if (Object.values(kinds).every((k) => k.weight === 0)) {
    problems.push("The deal needs a kind with a weight above zero.");
  }
  if (charactersWithFact * 2 <= everyone.length) {
    problems.push("The deal must give most Characters a Hidden Fact.");
  }
  if (charactersWithFact > everyone.length) {
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
function findBrokenBehaviours(content: Content): string[] {
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

/** The boss's signs must point somewhere without ever settling it. */
function findBrokenBossSigns(content: Content): string[] {
  const { character, signs } = content.boss;
  const problems = findBrokenOpinionSigns(signs, "Boss sign");
  if (!content.characters.some((c) => c.id === character)) {
    problems.push(`The boss names unknown Character "${character}".`);
  }
  return problems;
}

/** A first trip over the boss's head must be a gamble, and no words may name a kind. */
function findBrokenOverHead(content: Content): string[] {
  const { overHead: written } = content;
  if (!written) return [];
  const problems = findBrokenOpinionSigns(written.signs, "Over-head sign");
  if (!content.characters.some((c) => c.id === written.character)) {
    problems.push(`Over-head names unknown Character "${written.character}".`);
  }
  if (written.character === content.boss.character) {
    problems.push("Going over the boss's head cannot lead to the boss.");
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

function findBrokenOpinionSigns(
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
      problems.push(`${owner} can come from only one opinion.`);
    }
    if (new Set(likelihoods).size === 1) {
      problems.push(`${owner} gives no evidence: every opinion is as likely.`);
    }
  }
  if (signs.length > 0) {
    for (const mood of MOODS) {
      if (signs.every((s) => s.likelihood[mood] === 0)) {
        problems.push(`No boss sign can show a ${mood} opinion.`);
      }
    }
  }
  return problems;
}

/** An approach must split the kinds, and its words must never name one. */
function findBrokenApproaches(content: Content): string[] {
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

/** The player reads a kind from signs, so no reaction may say it out loud. */
function findNamedKinds(
  content: Content,
  owner: string,
  written: readonly string[],
): string[] {
  const labels = Object.values(content.hiddenTruth.kinds).map((k) =>
    k.label.toLowerCase(),
  );
  return written
    .filter((line) => labels.some((l) => line.toLowerCase().includes(l)))
    .map((line) => `${owner} names a kind: "${line}"`);
}

/** Lateness must be a clue about someone's kind, and never settle it. */
function findBrokenInput(content: Content): string[] {
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

/** A Demand must offer every answer, and stalling must be a real bet. */
function findBrokenDemands(content: Content): string[] {
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

/** Sources must be worth weighing: never always right, and never always wrong. */
function findBrokenSources(content: Content): string[] {
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

/** A catastrophe has to be fair: words for it, and a warning before the choice. */
function findBrokenMistakes(content: Content): string[] {
  const problems: string[] = [];
  const options = [
    ...everyNotification(content).flatMap((n) =>
      n.options.map((o) => ({
        owner: `Notification "${n.id}" option "${o.id}"`,
        stakes: o.stakes,
        outcomes: [o, ...(o.bet ? [o.bet.lost] : [])],
      })),
    ),
    ...content.scenes.flatMap((s) =>
      s.options.map((o) => ({
        owner: `Scene "${s.id}" option "${o.id}"`,
        stakes: o.stakes,
        outcomes: o.results,
      })),
    ),
  ];
  for (const { owner, stakes, outcomes } of options) {
    const catastrophic = outcomes.some((o) => o.mistake === "catastrophic");
    if (catastrophic && stakes === undefined) {
      problems.push(`${owner} is catastrophic, with no stakes to signal it.`);
    }
    if (!catastrophic && stakes !== undefined) {
      problems.push(`${owner} signals stakes it does not have.`);
    }
  }
  const anyMistake =
    options.some((o) => o.outcomes.some((x) => x.mistake !== undefined)) ||
    content.moves.some((m) => m.mistake !== undefined) ||
    content.actions.some((a) => a.mistake !== undefined);
  if (anyMistake && !content.mistakes) {
    problems.push("A big mistake is written, but no words for one.");
  }
  for (const a of content.actions) {
    if (a.mistake !== undefined && a.result === undefined) {
      problems.push(`Action "${a.id}" is a big mistake, so needs a result.`);
    }
  }
  return problems;
}

function findBrokenReferences(content: Content): string[] {
  const rooms = new Set(content.floor.rooms.map((r) => r.id));
  const dialogs = new Set(content.dialogs.map((d) => d.id));
  const buzzwords = new Set(content.buzzwords.map((b) => b.id));
  const scenes = new Set(content.scenes.map((s) => s.id));
  const characters = new Set(content.characters.map((c) => c.id));
  const hiddenFlags = flagsSetByHiddenResults(content);
  const problems: string[] = [];
  const checkCharacter = (owner: string, character: string) => {
    if (!characters.has(character)) {
      problems.push(`${owner} names unknown Character "${character}".`);
    }
  };
  const checkFact = (owner: string, fact: string) => {
    if (!content.hiddenTruth.facts.some((f) => f.id === fact)) {
      problems.push(`${owner} names unknown Hidden Fact "${fact}".`);
    }
  };
  const checkCondition = (owner: string, condition: Condition) => {
    if ("holderIs" in condition) checkCharacter(owner, condition.holderIs);
    if ("factNature" in condition) {
      checkCharacter(owner, condition.factNature.character);
    }
    if ("heardFact" in condition) checkFact(owner, condition.heardFact);
    if ("heardTrue" in condition) checkFact(owner, condition.heardTrue);
    if ("not" in condition) checkCondition(owner, condition.not);
    if ("all" in condition) {
      for (const inner of condition.all) checkCondition(owner, inner);
    }
    if ("hasBuzzword" in condition && !buzzwords.has(condition.hasBuzzword)) {
      problems.push(
        `${owner} needs unknown Buzzword "${condition.hasBuzzword}".`,
      );
    }
  };
  const checkParts = (owner: string, written: string, about = false) => {
    for (const [, token] of written.matchAll(/\{(\w+)\}/g)) {
      if (about && token === "subject") continue;
      if (token !== "holder" && token !== "ignored" && token !== "bystander") {
        problems.push(`${owner} uses unknown part "{${token ?? ""}}".`);
      }
    }
  };
  const checkMonths = (owner: string, wanted: readonly number[] = []) => {
    for (const month of wanted) {
      if (month > content.balance.monthsPerRun) {
        problems.push(
          `${owner} is set in month ${String(month)}, past the run.`,
        );
      }
    }
  };
  const checkApproach = (
    owner: string,
    { approach, reaction }: Pick<SceneResult, "approach" | "reaction">,
  ) => {
    if (
      approach !== undefined &&
      !content.boss.approaches.some((a) => a.id === approach)
    ) {
      problems.push(`${owner} uses unknown approach "${approach}".`);
    }
    if (reaction) {
      if (approach === undefined) {
        problems.push(`${owner} has a reaction with no approach to move it.`);
      }
      problems.push(...findNamedKinds(content, owner, Object.values(reaction)));
    }
  };
  const statuses = new Set(content.project.statuses.map((s) => s.id));
  const checkStatus = (owner: string, status: string) => {
    if (!statuses.has(status)) {
      problems.push(`${owner} names unknown status "${status}".`);
    }
  };
  const checkProject = (owner: string, change: SceneResult["project"]) => {
    const { real, reported } = change ?? {};
    const relative = (to: string) => to === "better" || to === "worse";
    if (real !== undefined && !relative(real)) checkStatus(owner, real);
    if (reported !== undefined && !relative(reported) && reported !== "real") {
      checkStatus(owner, reported);
    }
  };
  const checkCost = (owner: string, cost: string | undefined) => {
    if (cost !== undefined && !(cost in content.balance.actionCosts)) {
      problems.push(`${owner} has unknown cost "${cost}".`);
    }
  };

  problems.push(...findBrokenDeal(content, characters));
  problems.push(...findBrokenBehaviours(content));
  problems.push(...findBrokenBossSigns(content));
  const tagged = [
    ...content.actions,
    ...everyNotification(content).flatMap((n) => n.options),
    ...content.scenes.flatMap((sc) => sc.options),
  ].some((choice) => choice.family !== undefined);
  if (tagged && !content.families) {
    problems.push("Choices name a family, but no families are written.");
  }
  problems.push(...findBrokenOverHead(content));
  problems.push(...findBrokenApproaches(content));
  problems.push(...findBrokenSources(content));
  problems.push(...findBrokenInput(content));
  problems.push(...findBrokenDemands(content));
  problems.push(...findBrokenMistakes(content));
  const { flagged } = content.project;
  if (flagged) {
    checkStatus("The Project's flag", flagged.at);
    checkCost("The Project's flag", flagged.cost);
    const review = content.scenes.find((s) => s.id === flagged.scene);
    if (!review) {
      problems.push(
        `The Project's flag opens unknown Scene "${flagged.scene}".`,
      );
    }
    if (review?.months) {
      problems.push(
        `Scene "${flagged.scene}" opens when flagged, not by month.`,
      );
    }
    if (content.actions.some((a) => a.scene === flagged.scene)) {
      problems.push(
        `Scene "${flagged.scene}" opens when flagged, not by action.`,
      );
    }
  }
  checkStatus("The Project", content.project.start.real);
  checkStatus("The Project", content.project.start.reported);
  for (const e of content.project.events) {
    checkMonths("A Project event", e.months);
    checkProject("A Project event", e.project);
  }
  for (const a of content.actions) {
    checkApproach(`Action "${a.id}"`, a);
    checkProject(`Action "${a.id}"`, a.project);
    if (!rooms.has(a.place)) {
      problems.push(`Action "${a.id}" is at unknown place "${a.place}".`);
    }
    checkCost(`Action "${a.id}"`, a.cost);
    checkMonths(`Action "${a.id}"`, a.months);
    if (a.scene !== undefined && !scenes.has(a.scene)) {
      problems.push(`Action "${a.id}" opens unknown Scene "${a.scene}".`);
    }
    const opens = content.scenes.find((s) => s.id === a.scene);
    if (
      a.months &&
      opens?.months &&
      !a.months.some((month) => opens.months?.includes(month))
    ) {
      problems.push(`Action "${a.id}" is set when its Scene never opens.`);
    }
    const outcomes = [
      a.scene,
      a.result,
      a.findOut,
      a.overHead ? true : undefined,
    ].filter((o) => o !== undefined);
    if (outcomes.length !== 1) {
      problems.push(
        `Action "${a.id}" needs one of a Scene, a result, a Find Out or going over the boss's head.`,
      );
    }
    if (a.overHead && !content.overHead) {
      problems.push(`Action "${a.id}" needs over-head content.`);
    }
    if (
      a.findOut !== undefined &&
      !content.sources.methods.some((m) => m.id === a.findOut)
    ) {
      problems.push(`Action "${a.id}" uses unknown Find Out "${a.findOut}".`);
    }
  }
  for (const c of content.characters) {
    const owner = `Character "${c.id}"`;
    if (c.reportsTo !== undefined) checkCharacter(owner, c.reportsTo);
    const seen = new Set([c.id]);
    let above = content.characters.find((m) => m.id === c.reportsTo);
    while (above) {
      if (seen.has(above.id)) {
        problems.push(`${owner} is in a loop on the Org Chart.`);
        break;
      }
      seen.add(above.id);
      const manager = above.reportsTo;
      above = content.characters.find((m) => m.id === manager);
    }
  }
  for (const s of content.scenes) {
    const owner = `Scene "${s.id}"`;
    checkMonths(owner, s.months);
    for (const c of s.cast) checkCharacter(owner, c);
    if (
      s.cast.length < 3 &&
      /\{(holder|ignored|bystander)\}/.test(JSON.stringify(s))
    ) {
      problems.push(`${owner} names parts, which need three people present.`);
    }
    for (const line of s.narration) checkParts(owner, line);
    for (const sign of s.signs) {
      checkParts(owner, sign.text);
      checkParts(owner, sign.clue ?? "");
    }
    for (const o of s.options) {
      const optionOwner = `${owner} option "${o.id}"`;
      const about = o.about !== undefined;
      if (o.about !== undefined) checkFact(optionOwner, o.about);
      checkParts(optionOwner, o.label, about);
      for (const r of o.results) {
        checkParts(optionOwner, r.body, about);
        checkParts(optionOwner, r.factNote ?? "", about);
        if (r.factAt !== undefined) checkCharacter(optionOwner, r.factAt);
        if (r.when) checkCondition(optionOwner, r.when);
        checkApproach(optionOwner, r);
        checkProject(optionOwner, r.project);
      }
      if (o.requires) {
        checkCondition(optionOwner, o.requires);
        if (dependsOnHiddenTruth(o.requires, hiddenFlags)) {
          problems.push(`${optionOwner} is gated on the hidden truth.`);
        }
      }
      if (o.results.at(-1)?.when !== undefined) {
        problems.push(`${optionOwner} needs a fallback result with no "when".`);
      }
    }
  }
  for (const e of content.notebook.events) {
    const owner = `Notebook event "${e.id}"`;
    checkMonths(owner, e.months);
    checkCondition(owner, e.when);
    // A hidden result's flag is fine here: the player has just seen that result.
    if (dependsOnHiddenTruth(e.when)) {
      problems.push(`${owner} is gated on the hidden truth.`);
    }
  }
  for (const m of content.moves) {
    const owner = `Move "${m.id}"`;
    checkMonths(owner, m.months);
    checkParts(owner, m.body);
    if (m.when) checkCondition(owner, m.when);
  }
  for (const e of content.officialStory.entries) {
    const owner = "An official story entry";
    checkParts(owner, e.reported ?? "");
    checkParts(owner, e.happened ?? "");
    if (e.when) checkCondition(owner, e.when);
    checkMonths(owner, e.months);
  }
  for (const n of everyNotification(content)) {
    checkMonths(`Notification "${n.id}"`, n.months);
    if (n.when) {
      checkCondition(`Notification "${n.id}"`, n.when);
      if (dependsOnHiddenTruth(n.when, hiddenFlags)) {
        problems.push(`Notification "${n.id}" is gated on the hidden truth.`);
      }
    }
    for (const [, token] of n.body.matchAll(/\{(\w+)\}/g)) {
      if (token !== "real" && token !== "reported") {
        problems.push(
          `Notification "${n.id}" uses unknown token "{${token ?? ""}}".`,
        );
      }
    }
    for (const o of n.options) {
      const owner = `Notification "${n.id}" option "${o.id}"`;
      checkCost(owner, o.cost);
      checkApproach(owner, o);
      checkProject(owner, o.project);
      if (o.bet) {
        checkApproach(owner, o.bet.lost);
        checkProject(owner, o.bet.lost.project);
      }
      if (o.dialog !== undefined && !dialogs.has(o.dialog)) {
        problems.push(`${owner} opens unknown dialog "${o.dialog}".`);
      }
      for (const word of o.learns) {
        if (!buzzwords.has(word)) {
          problems.push(`${owner} teaches unknown Buzzword "${word}".`);
        }
      }
    }
  }
  return problems;
}
