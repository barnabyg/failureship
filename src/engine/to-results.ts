import { startedAs } from "./changes";
import { MOVE_FAMILIES, type Content } from "./content";
import { dealsInResults } from "./deals";
import { gaugesInView } from "./gauges";
import { plansInResults } from "./grand-plans";
import { bossOf, headOf } from "./places";
import { promisesInResults } from "./promises";
import { rivalsInResults } from "./rivals";
import { bossKindOf, moodOf, moodOfCharacter, personOf } from "./reads";
import { calledBy, sayPeople, titleOf } from "./say";
import { standingAtEnd } from "./standing";
import type { State } from "./state";
import { vacanciesInResults } from "./vacancies";
import type { StepView } from "./view";

/** The reveal. It reaches the player view only here, once the run has ended. */
export function toResultsView(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }> {
  const nameOf = (id: string) =>
    content.characters.find((c) => c.id === id)?.name ?? id;
  const { order, influence } = state.truth.powerMap;
  return {
    kind: "results",
    ...(state.firedIn !== null && content.mistakes
      ? content.mistakes.results
      : content.ui.results),
    ending: toEnding(state, content),
    standing: toStandingResults(state, content),
    vacancies: vacanciesInResults(state, content),
    mistakes: state.mistakes,
    milestones: gaugesInView(state, content).milestones,
    changed: state.truth.changes.flatMap((change) => {
      const written = content.changing;
      if (!written) return [];
      const { name, title } = personOf(state, content, change.character);
      return [
        {
          month: change.month,
          name,
          title,
          from: content.hiddenTruth.kinds[change.from].label,
          to: written.became[change.to],
          why: change.why,
        },
      ];
    }),
    promises: promisesInResults(state, content),
    rivals: rivalsInResults(state, content),
    grandPlans: plansInResults(state, content),
    ...dealsInResults(state, content),
    beliefs: toBeliefs(state, content),
    changes: state.eventsLanded.flatMap(({ id, month }) => {
      const written = content.events.find((e) => e.id === id);
      return written?.changed === undefined
        ? []
        : [{ month, title: written.title, changed: written.changed }];
    }),
    risks: state.truth.risks.flatMap((risk) => {
      const written = content.risks.find((r) => r.id === risk.id);
      if (!written) return [];
      const { cameOut } = risk;
      const landed = cameOut?.onPlayer
        ? written.landedOnYou
        : written.landedElsewhere;
      const through = cameOut?.through;
      const motive =
        through !== undefined && content.changing
          ? sayPeople(content.changing.whistleblower.motive, {
              "{who}": calledBy(state, content, through),
            })
          : written.route.motive;
      return [
        {
          addedIn: risk.month,
          note: written.note,
          motive,
          cameOutIn: cameOut?.month ?? null,
          fate: cameOut ? landed : written.neverCameOut,
        },
      ];
    }),
    threads: state.threads.flatMap((started) => {
      const written = content.threads.find((t) => t.id === started.id);
      return started.played && written
        ? [
            {
              startedIn: started.month,
              started: written.started,
              playedIn: started.played.month,
              playedOut: started.played.text,
            },
          ]
        : [];
    }),
    characters: state.truth.characters.map((dealt) => {
      const known = content.characters.find((c) => c.id === dealt.id);
      return {
        name: known?.name ?? dealt.id,
        title: titleOf(state, content, dealt.id),
        kind: content.hiddenTruth.kinds[startedAs(state, dealt.id, dealt.kind)]
          .label,
        fact: dealt.fact?.text ?? null,
      };
    }),
    powerMap: order.map((id) => {
      const above = influence.find((i) => i.over === id);
      return {
        name: nameOf(id),
        title: titleOf(state, content, id),
        reportsTo: above ? nameOf(above.who) : null,
      };
    }),
    marks: state.truth.characters.map((dealt) => {
      const mark = state.marks[dealt.id] ?? null;
      const { kinds } = content.hiddenTruth;
      return {
        name: nameOf(dealt.id),
        title: personOf(state, content, dealt.id).title,
        mark: mark === null ? null : kinds[mark].label,
        truth: kinds[startedAs(state, dealt.id, dealt.kind)].label,
        correct:
          mark === dealt.kind ||
          mark === startedAs(state, dealt.id, dealt.kind),
      };
    }),
    clues: state.clues.map(({ month, source, text, verdict }) => ({
      month,
      source,
      text,
      verdict: content.ui.clueVerdicts[verdict],
    })),
    factEvents: state.factEvents,
    boss: toBossResults(state, content),
    played: MOVE_FAMILIES.flatMap((id) => {
      const written = content.families?.[id];
      return written
        ? [
            {
              family: written.label,
              note: written.note,
              count: state.played[id] ?? 0,
            },
          ]
        : [];
    }),
    claims: state.claims.map((claim) => {
      const { label, note } = content.sources.verdicts[claim.status];
      const said = state.truth.characters.find((c) => c.id === claim.source);
      const motive = content.sources.motives.find((m) => m.id === said?.motive);
      const source = nameOf(claim.source);
      return {
        month: claim.month,
        source,
        text: claim.text,
        verdict: label,
        note,
        motive: (motive?.text ?? "").replaceAll("{name}", source),
      };
    }),
  };
}

/** Everyone, what they ended up believing, and what reached them. It says no number. */
function toBeliefs(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }>["beliefs"] {
  const written = content.reputation;
  if (!written) return [];
  return content.characters.map(({ id, name }) => ({
    name,
    title: titleOf(state, content, id),
    believes: written.believes[moodOfCharacter(state, content, id)],
    reached: state.truth.memories
      .filter((m) => m.character === id)
      .map(({ month, text, via, news, foundOut }) => {
        const stories = written.falseStories;
        const started = state.truth.news[news ?? -1]?.startedBy === id;
        const how =
          typeof via === "string"
            ? sayPeople(written.how.heardFrom, {
                "{who}": calledBy(state, content, via),
              })
            : written.how.direct;
        const found =
          foundOut === null || !stories
            ? ""
            : ` ${stories.found.replaceAll("{month}", String(foundOut))}`;
        return {
          month,
          text,
          how: started && stories ? stories.started : `${how}${found}`,
        };
      }),
  }));
}

/**
 * Official standing beside who really decides. Until vacancies exist, that is
 * whoever holds influence over the boss on the Power Map, or else the boss.
 */
function toStandingResults(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }>["standing"] {
  const standing = standingAtEnd(state, content);
  if (!standing) return null;
  const boss = bossOf(state, content);
  const decider =
    state.truth.powerMap.influence.find((i) => i.over === boss)?.who ?? boss;
  return {
    ...standing,
    decides: standing.decides.replaceAll(
      "{who}",
      personOf(state, content, decider).name,
    ),
    believes:
      content.reputation?.believes[moodOfCharacter(state, content, decider)] ??
      null,
  };
}

function toEnding(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }>["ending"] {
  const fired = state.firedIn !== null;
  const written = fired
    ? content.mistakes?.firedIn
    : content.mistakes?.finished;
  return {
    fired,
    text: written?.replaceAll("{month}", String(state.firedIn)) ?? null,
  };
}

function toBossResults(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }>["boss"] {
  const { warmer, cooler, unmoved } = content.ui.bossLanded;
  const boss = bossOf(state, content);
  const { name, title } = personOf(state, content, boss);
  return {
    name,
    title,
    kind: content.hiddenTruth.kinds[bossKindOf(state, content)].label,
    // Missing the Scene does not spare the player: the verdict is given anyway.
    verdict:
      state.verdict ??
      content.scenes.find((s) => s.verdict)?.verdict?.[
        moodOf(state, content)
      ] ??
      null,
    // Only what came across to this boss, not to anyone who was boss before.
    choices: state.bossLandings
      .filter((landing) => landing.boss === boss)
      .map(({ month, choice, shift }) => ({
        month,
        choice,
        landed: shift > 0 ? warmer : shift < 0 ? cooler : unmoved,
      })),
    head: toHeadResults(state, content),
  };
}

/** What the boss's boss really made of the player. It says no number. */
function toHeadResults(
  state: State,
  content: Content,
): Extract<StepView, { kind: "results" }>["boss"]["head"] {
  const written = content.overHead;
  const head = headOf(state, content);
  const dealt = state.truth.characters.find((c) => c.id === head);
  if (!written || !dealt) return null;
  const { name, title } = personOf(state, content, dealt.id);
  return {
    name,
    title,
    kind: content.hiddenTruth.kinds[dealt.kind].label,
    verdict: written.verdict[moodOfCharacter(state, content, dealt.id)],
  };
}
