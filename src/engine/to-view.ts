import {
  everyBill,
  everyDemand,
  everyNotification,
  type Content,
} from "./content";
import {
  actionsThisMonth,
  costOf,
  coverForGone,
  fillParts,
  fillSubject,
  isAvailable,
  isDone,
  isMet,
  matches,
  methodOf,
  offeredOptions,
  optionsOnOffer,
  personOf,
  remaining,
} from "./reads";
import { YOU } from "./deal";
import { dealsInView } from "./deals";
import { floorNow, isOn } from "./floors";
import { gaugesInView, gaugesThisMonth } from "./gauges";
import { isGone, managerOf } from "./places";
import { promisesInView } from "./promises";
import { COMPETITOR } from "./rivals";
import { sceneData } from "./scenes";
import { calledBy, sayFrom, sayPeople, titleOf } from "./say";
import { standingInView } from "./standing";
import { planInView } from "./grand-plans";
import type { State, Step, World } from "./state";
import { toResultsView } from "./to-results";
import { toWinView } from "./win";
import type {
  Buzzword,
  ChartEntry,
  Choice,
  Hotspot,
  NotificationOption,
  PlayerView,
  StepView,
} from "./view";

export function legalChoices(state: State, world: World): Choice[] {
  const { content } = world;
  const { step } = state;
  switch (step.kind) {
    case "notification":
      return notificationOptions(state, content, step.id)
        .filter((o) => o.affordable)
        .map((o) => ({
          type: "notification",
          notificationId: step.id,
          optionId: o.id,
        }));
    case "actions":
      return actionsThisMonth(state, content)
        .filter((a) => isAvailable(state, content, a))
        .map((a) => ({ type: "action", actionId: a.id }));
    case "scene":
      return offeredOptions(
        state,
        content,
        sceneData(state, world, step.id),
      ).map((o) => ({
        type: "scene",
        sceneId: step.id,
        optionId: o.id,
      }));
    case "find-out":
      return step.sources.flatMap((sourceId) =>
        content.characters
          .filter(
            (c) =>
              c.id !== sourceId &&
              !isGone(state, c.id) &&
              isMet(state, content, c.id),
          )
          .map((c) => ({
            type: "find-out" as const,
            sourceId,
            subjectId: c.id,
          })),
      );
    case "claim":
    case "dialog":
    case "notice":
    case "move":
    case "event":
    case "win":
      return [{ type: "continue" }];
    case "story":
      return [{ type: "continue" }];
    case "results":
      return [];
  }
}

function notificationOptions(
  state: State,
  content: Content,
  id: string,
): NotificationOption[] {
  const notification = everyNotification(content).find((n) => n.id === id);
  return optionsOnOffer(state, content, notification?.options ?? []).map(
    (o) => ({
      id: o.id,
      label: o.label,
      costLabel: costLabel(content, o.cost),
      affordable: costOf(content, o.cost) <= remaining(state, content),
      stakes: o.stakes,
    }),
  );
}

function toSceneView(
  state: State,
  world: World,
  {
    id,
    shown,
    treatment,
    headTreatment,
    regard,
    misleading,
  }: Extract<Step, { kind: "scene" }>,
): Extract<StepView, { kind: "scene" }> {
  const { content } = world;
  const scene = sceneData(state, world, id);
  const fill = (written: string) =>
    fillParts(state, content, written, scene.cast);
  return {
    kind: "scene",
    id: scene.id,
    title: scene.title,
    location: scene.location,
    narration: scene.narration.map(fill),
    cast: scene.cast.flatMap((c) =>
      content.characters
        .filter((x) => x.id === c)
        .map((x) => ({ name: x.name, title: titleOf(state, content, x.id) })),
    ),
    signs: scene.signs.map((s) => ({
      label: s.label,
      text: fillParts(state, content, s.text, scene.cast, misleading),
    })),
    behaviours: shown.map(({ character, behaviour }) => {
      const who = calledBy(state, content, character);
      const written = [
        ...content.behaviours,
        ...(content.changing?.whistleblower.signs ?? []),
      ].find((b) => b.id === behaviour);
      return {
        who,
        text: sayPeople(written?.text ?? "", { "{who}": who }),
      };
    }),
    treatment: content.boss.signs.find((s) => s.id === treatment)?.text ?? null,
    headTreatment:
      content.overHead?.signs.find((s) => s.id === headTreatment)?.text ?? null,
    regard: regard.map(({ character, sign }) => {
      const written = content.reputation?.signs.find((s) => s.id === sign);
      const who = calledBy(state, content, character);
      return { who, text: sayPeople(written?.text ?? "", { "{who}": who }) };
    }),
    options: offeredOptions(state, content, scene).map((o) => ({
      id: o.id,
      label: fillSubject(state, content, o.about, fill(o.label)),
      stakes: o.stakes,
    })),
  };
}

function toStoryView(
  state: State,
  content: Content,
): Extract<StepView, { kind: "story" }> {
  const { title, reportedHeading, happenedHeading, entries } =
    content.officialStory;
  const told = entries.filter(
    (e) => isOn(state, content, e) && matches(state, content, e.when),
  );
  const fill = (written: string | undefined) =>
    written === undefined ? undefined : fillParts(state, content, written);
  // Each Company Event of the month, in the story's own words for it.
  const events = state.eventsLanded
    .filter((landed) => landed.month === state.month)
    .flatMap(({ id }) => content.events.filter((e) => e.id === id))
    .map((e) => e.story);
  return {
    kind: "story",
    title: title.replaceAll("{job}", floorNow(state, content).title),
    reportedHeading,
    happenedHeading,
    // Both lines of a pair come from the same written thing, never matched up later.
    pairs: [...events, ...told].map((e) => ({
      reported: fill(e.reported),
      happened: fill(e.happened),
    })),
    gauges: gaugesThisMonth(state, content),
  };
}

/** The formal hierarchy, the same in every deal until a Company Event moves it. */
function toOrgChart(state: State, content: Content): ChartEntry[] {
  const here = content.characters.filter(
    (c) => !isGone(state, c.id) && isMet(state, content, c.id),
  );
  const you = content.you.name;
  const nameOf = (id: string | undefined) =>
    id === YOU
      ? you
      : (content.characters.find((m) => m.id === id)?.name ?? null);
  const managerHere = (id: string) => {
    let manager = managerOf(state, content, id);
    while (
      manager !== undefined &&
      manager !== YOU &&
      (isGone(state, manager) || !isMet(state, content, manager))
    ) {
      manager = managerOf(state, content, manager);
    }
    return manager;
  };
  const chart = here.map((c) => ({
    name: c.name,
    title: titleOf(state, content, c.id),
    reportsTo: nameOf(managerHere(c.id)),
  }));
  // The player is on it once anyone answers to them.
  if (!chart.some((entry) => entry.reportsTo === you)) return chart;
  return [
    ...chart,
    {
      name: you,
      title: floorNow(state, content).title,
      reportsTo: nameOf(managerHere(YOU)),
    },
  ];
}

function toStepView(state: State, world: World): StepView {
  const { content } = world;
  const { step } = state;
  switch (step.kind) {
    case "notification": {
      const n = everyNotification(content).find((x) => x.id === step.id);
      if (!n) throw new Error(`Unknown Notification "${step.id}".`);
      return {
        kind: "notification",
        id: n.id,
        from: sayFrom(state, content, n.from),
        subject: n.subject,
        body: n.body
          .replaceAll("{real}", statusLabel(content, state.project.real))
          .replaceAll(
            "{reported}",
            statusLabel(content, state.project.reported),
          ),
        options: notificationOptions(state, content, n.id),
      };
    }
    case "dialog": {
      const dialog = content.dialogs.find((d) => d.id === step.id);
      if (!dialog) throw new Error(`Unknown dialog "${step.id}".`);
      return {
        kind: "dialog",
        title: dialog.title,
        lines: dialog.lines,
        learned: buzzwordsOf(content, step.learned),
        reaction: step.reaction,
      };
    }
    case "scene":
      return toSceneView(state, world, step);
    case "find-out": {
      const method = methodOf(content, step.method);
      const sources = step.sources.map((id) => personOf(state, content, id));
      return {
        kind: "find-out",
        title: method.title,
        prompt: sayPeople(method.prompt, {
          "{source}": calledBy(state, content, sources[0]?.id ?? ""),
        }),
        sources,
        subjects: content.characters
          .filter((c) => !isGone(state, c.id) && isMet(state, content, c.id))
          .map((c) => personOf(state, content, c.id)),
      };
    }
    case "claim": {
      const claim = state.claims[step.index];
      if (!claim) throw new Error(`Unknown claim ${String(step.index)}.`);
      return {
        kind: "claim",
        title: sayPeople(content.ui.claimTitle, {
          "{source}": calledBy(state, content, claim.source),
        }),
        text: claim.text,
      };
    }
    case "move": {
      const move = [...content.moves, ...everyBill(content)].find(
        (m) => m.id === step.id,
      );
      if (!move) throw new Error(`Unknown Move "${step.id}".`);
      const body = sayPeople(move.body, {
        [COMPETITOR]:
          step.by === undefined ? "" : calledBy(state, content, step.by),
      });
      return {
        kind: "move",
        from: sayFrom(state, content, move.from ?? ""),
        title: move.title,
        body: fillParts(state, content, body),
      };
    }
    case "event": {
      const event = content.events.find((e) => e.id === step.id);
      if (!event) throw new Error(`Unknown Company Event "${step.id}".`);
      return {
        kind: "event",
        from: sayFrom(state, content, event.from),
        title: event.title,
        body: event.body,
      };
    }
    case "story":
      return toStoryView(state, content);
    case "win":
      return toWinView(state, content);
    case "results":
      return toResultsView(state, content);
    case "actions":
    case "notice":
      return step;
  }
}

/** The step, with whoever covers for anyone who has gone written in their place. */
function shownStep(state: State, world: World): StepView {
  const step = toStepView(state, world);
  const asWritten = state.step.kind === "notice" && state.step.asWritten;
  if (step.kind === "results" || asWritten) return step;
  return coverForGone(state, world.content, step);
}

function statusLabel(content: Content, id: string): string {
  return content.project.statuses.find((s) => s.id === id)?.label ?? id;
}

function statusColour(content: Content, id: string): string {
  return content.project.statuses.find((s) => s.id === id)?.colour ?? "";
}

function toProjectView(state: State, content: Content): PlayerView["project"] {
  const { name, owner } = content.project;
  const { real, reported, news } = state.project;
  return {
    name,
    owner,
    real: statusLabel(content, real),
    reported: statusLabel(content, reported),
    realColour: statusColour(content, real),
    reportedColour: statusColour(content, reported),
    news,
  };
}

export function toView(state: State, world: World): PlayerView {
  const { content } = world;
  const left = remaining(state, content);
  const actionsLabel = countActions(content, left);
  return structuredClone({
    notebook: {
      clues: state.clues.map(({ month, source, text }) => ({
        month,
        source,
        text,
      })),
      marks: content.characters
        .filter((c) => isMet(state, content, c.id))
        .map((c) => ({
          ...personOf(state, content, c.id),
          mark: state.marks[c.id] ?? null,
        })),
    },
    project: toProjectView(state, content),
    grandPlan: planInView(state, content),
    openDemands: state.openDemands.flatMap(({ id, month }) => {
      const item = everyDemand(content).find((d) => d.id === id);
      return item ? [{ month, subject: item.subject }] : [];
    }),
    promises: promisesInView(state, content),
    ...dealsInView(state, content),
    ...gaugesInView(state, content),
    standing: standingInView(state, content),
    finalWarning: state.finalWarning,
    job: { id: state.job, title: floorNow(state, content).title },
    seed: state.seed,
    month: state.month,
    totalMonths: content.balance.monthsPerRun,
    actions: {
      total: content.balance.actionsPerMonth,
      spent: state.spent,
      remaining: left,
      label: actionsLabel,
    },
    buzzwords: buzzwordsOf(content, state.buzzwords),
    orgChart: toOrgChart(state, content),
    hotspots: actionsThisMonth(state, content).map((a) =>
      toHotspot(state, content, a),
    ),
    step: shownStep(state, world),
    hint: content.ui.hints[state.step.kind].replaceAll(
      "{actions}",
      actionsLabel,
    ),
    choices: legalChoices(state, world),
  });
}

/** In the order learned, which is the order the header and its list show. */
function buzzwordsOf(content: Content, ids: readonly string[]): Buzzword[] {
  return ids.flatMap((id) => content.buzzwords.find((b) => b.id === id) ?? []);
}

function toHotspot(
  state: State,
  content: Content,
  action: Content["actions"][number],
): Hotspot {
  const done = isDone(state, action);
  return {
    id: action.id,
    label: action.label,
    description: action.description,
    place: action.place,
    costLabel: costLabel(content, action.cost),
    state: done
      ? "done"
      : isAvailable(state, content, action)
        ? "available"
        : "unavailable",
  };
}

function costLabel(content: Content, key: string | undefined): string {
  const cost = costOf(content, key);
  return cost === 0
    ? content.ui.freeLabel
    : content.ui.costLabel.replaceAll("{actions}", countActions(content, cost));
}

function countActions(content: Content, n: number): string {
  const { one, other } = content.ui.actionCount;
  return n === 1 ? one : other.replaceAll("{n}", String(n));
}
