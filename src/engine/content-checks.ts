import { z } from "zod";
import {
  findBrokenApproaches,
  findBrokenBossSigns,
  findBrokenDemands,
  findBrokenOverHead,
  findBrokenReputation,
} from "./boss-checks";
import {
  findNamedKinds,
  findBrokenEvents,
  findBrokenChanging,
  findBrokenGauges,
  findBrokenMistakes,
  findBrokenRisks,
  findBrokenStanding,
  findBrokenThreads,
} from "./consequence-checks";
import {
  contentSchema,
  everyBill,
  everyNotification,
  type Condition,
  type Content,
  type SceneData,
} from "./content";
import { findBrokenFloors } from "./floor-checks";
import { findBrokenPlans } from "./plan-checks";
import { findBrokenReviews } from "./review-checks";
import { findBrokenRivals, withoutMaker } from "./rival-checks";
import { bossesAtStart, meantBy } from "./places";
import {
  dependsOnHiddenTruth,
  findBrokenBehaviours,
  findBrokenDeal,
  findBrokenInput,
  findBrokenSources,
  flagsSetByHiddenResults,
} from "./truth-checks";
import { findBrokenDeals, findBrokenPromises } from "./word-checks";

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

function findBrokenReferences(content: Content): string[] {
  const rooms = new Set(
    content.floors.flatMap((f) => f.rooms).map((r) => r.id),
  );
  const dialogs = new Set(content.dialogs.map((d) => d.id));
  const buzzwords = new Set(content.buzzwords.map((b) => b.id));
  const scenes = new Set(content.scenes.map((s) => s.id));
  const moves = new Set(content.moves.map((m) => m.id));
  const characters = new Set(content.characters.map((c) => c.id));
  const plans = new Set(content.grandPlans?.plans.map((p) => p.id));
  const hiddenFlags = flagsSetByHiddenResults(content);
  const problems: string[] = [];
  const bosses = bossesAtStart(content);
  /** Where data must name a Character, whatever their place. */
  const checkCharacter = (owner: string, character: string) => {
    if (!characters.has(character)) {
      problems.push(`${owner} names unknown Character "${character}".`);
    }
  };
  /** Where data can name a place above the player instead, which must be filled. */
  const checkCharacterOrPlace = (owner: string, written: string) => {
    checkCharacter(owner, meantBy(bosses, written) ?? written);
  };
  const checkFact = (owner: string, fact: string) => {
    if (!content.hiddenTruth.facts.some((f) => f.id === fact)) {
      problems.push(`${owner} names unknown Hidden Fact "${fact}".`);
    }
  };
  const checkCondition = (owner: string, condition: Condition) => {
    if ("holderIs" in condition)
      checkCharacterOrPlace(owner, condition.holderIs);
    if ("factNature" in condition) {
      checkCharacterOrPlace(owner, condition.factNature.character);
    }
    if ("remembers" in condition) {
      checkCharacterOrPlace(owner, condition.remembers.character);
    }
    if ("believes" in condition) {
      checkCharacterOrPlace(owner, condition.believes.character);
    }
    if ("youOwe" in condition) checkCharacterOrPlace(owner, condition.youOwe);
    if ("heardFact" in condition) checkFact(owner, condition.heardFact);
    if ("heardTrue" in condition) checkFact(owner, condition.heardTrue);
    if ("not" in condition) checkCondition(owner, condition.not);
    if ("all" in condition) {
      for (const inner of condition.all) checkCondition(owner, inner);
    }
    if ("any" in condition) {
      for (const inner of condition.any) checkCondition(owner, inner);
    }
    if ("sawMove" in condition && !moves.has(condition.sawMove)) {
      problems.push(`${owner} needs unknown Move "${condition.sawMove}".`);
    }
    if ("planRunning" in condition && !plans.has(condition.planRunning)) {
      problems.push(
        `${owner} needs unknown Grand Plan "${condition.planRunning}".`,
      );
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

  problems.push(...findBrokenFloors(content));
  problems.push(...findBrokenReviews(content, hiddenFlags));
  problems.push(...findBrokenRivals(content));
  problems.push(...findBrokenPlans(content, hiddenFlags));
  for (const plan of content.grandPlans?.plans ?? []) {
    for (const way of plan.ways) {
      checkCondition(`Grand Plan "${plan.id}" way "${way.id}"`, way.when);
    }
  }
  problems.push(...findBrokenDeal(content, characters));
  problems.push(...findBrokenBehaviours(content));
  problems.push(...findBrokenBossSigns(content));
  const tagged = [
    ...content.actions,
    ...everyNotification(content).flatMap((n) => n.options),
    ...content.scenes.flatMap((sc) => sc.options),
    ...content.moves,
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
  problems.push(...findBrokenThreads(content));
  problems.push(...findBrokenRisks(content));
  problems.push(...findBrokenEvents(content));
  problems.push(...findBrokenPromises(content));
  problems.push(...findBrokenDeals(content));
  problems.push(...findBrokenChanging(content));
  problems.push(...findBrokenGauges(content));
  problems.push(...findBrokenStanding(content));
  problems.push(...findBrokenReputation(content, characters));
  for (const event of content.events) {
    checkProject(`Company Event "${event.id}"`, event.project);
  }
  for (const risk of content.risks) {
    const owner = `Risk "${risk.id}"`;
    checkCondition(owner, risk.traced);
    if (risk.route.means) checkCondition(owner, risk.route.means);
  }
  for (const b of everyBill(content)) {
    for (const memory of b.remembers) {
      checkCharacterOrPlace(`Bill "${b.id}"`, memory.character);
    }
    checkProject(`Bill "${b.id}"`, b.project);
  }
  for (const thread of content.threads) {
    for (const outcome of thread.outcomes) {
      const owner = `Thread "${thread.id}"`;
      if (outcome.when) checkCondition(owner, outcome.when);
    }
  }
  for (const report of content.changing?.whistleblower.reports ?? []) {
    const owner = `Whistleblower report "${report.bill.id}"`;
    if (report.when) checkCondition(owner, report.when);
  }
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
  checkCharacter("The player", content.you.reportsTo);
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
        if (r.factAt !== undefined)
          checkCharacterOrPlace(optionOwner, r.factAt);
        if (r.when) checkCondition(optionOwner, r.when);
        checkApproach(optionOwner, r);
        checkProject(optionOwner, r.project);
        for (const memory of r.remembers) {
          checkCharacterOrPlace(optionOwner, memory.character);
        }
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
    if (m.repays !== undefined) checkCharacterOrPlace(owner, m.repays);
    checkMonths(owner, m.months);
    checkParts(owner, withoutMaker(m));
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
      for (const memory of [...o.remembers, ...(o.bet?.lost.remembers ?? [])]) {
        checkCharacterOrPlace(owner, memory.character);
      }
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
