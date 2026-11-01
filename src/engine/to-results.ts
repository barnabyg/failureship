import { MOVE_FAMILIES, type Content } from "./content";
import { bossKindOf, moodAt, moodOf, personOf } from "./reads";
import type { State } from "./state";
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
    mistakes: state.mistakes,
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
      return [
        {
          addedIn: risk.month,
          note: written.note,
          motive: written.route.motive,
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
        title: known?.title ?? "",
        kind: content.hiddenTruth.kinds[dealt.kind].label,
        fact: dealt.fact?.text ?? null,
      };
    }),
    powerMap: order.map((id) => {
      const above = influence.find((i) => i.over === id);
      return {
        name: nameOf(id),
        title: content.characters.find((c) => c.id === id)?.title ?? "",
        reportsTo: above ? nameOf(above.who) : null,
      };
    }),
    marks: state.truth.characters.map((dealt) => {
      const mark = state.marks[dealt.id] ?? null;
      const { kinds } = content.hiddenTruth;
      return {
        name: nameOf(dealt.id),
        title: personOf(content, dealt.id).title,
        mark: mark === null ? null : kinds[mark].label,
        truth: kinds[dealt.kind].label,
        correct: mark === dealt.kind,
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
  const { name, title } = personOf(content, content.boss.character);
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
    choices: state.bossLandings.map(({ month, choice, shift }) => ({
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
  const dealt = state.truth.characters.find((c) => c.id === written?.character);
  if (!written || !dealt) return null;
  const { name, title } = personOf(content, dealt.id);
  return {
    name,
    title,
    kind: content.hiddenTruth.kinds[dealt.kind].label,
    verdict: written.verdict[moodAt(state.truth.headOpinion, written.opinion)],
  };
}
