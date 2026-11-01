import { everyDemand, everyNotification, type Content } from "./content";
import {
  actionsThisMonth,
  costOf,
  fillParts,
  fillSubject,
  inMonth,
  isAvailable,
  isDone,
  matches,
  methodOf,
  offeredOptions,
  personOf,
  remaining,
  sceneData,
} from "./reads";
import { calledBy, sayPeople } from "./say";
import type { State, Step, World } from "./state";
import { toResultsView } from "./to-results";
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
          .filter((c) => c.id !== sourceId)
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
  return (notification?.options ?? []).map((o) => ({
    id: o.id,
    label: o.label,
    costLabel: costLabel(content, o.cost),
    affordable: costOf(content, o.cost) <= remaining(state, content),
    stakes: o.stakes,
  }));
}

function toSceneView(
  state: State,
  world: World,
  {
    id,
    shown,
    treatment,
    headTreatment,
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
        .map((x) => ({ name: x.name, title: x.title })),
    ),
    signs: scene.signs.map((s) => ({
      label: s.label,
      text: fillParts(state, content, s.text, scene.cast, misleading),
    })),
    behaviours: shown.map(({ character, behaviour }) => {
      const who = calledBy(content, character);
      const written = content.behaviours.find((b) => b.id === behaviour);
      return {
        who,
        text: sayPeople(written?.text ?? "", { "{who}": who }),
      };
    }),
    treatment: content.boss.signs.find((s) => s.id === treatment)?.text ?? null,
    headTreatment:
      content.overHead?.signs.find((s) => s.id === headTreatment)?.text ?? null,
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
    (e) => inMonth(e, state.month) && matches(state, content, e.when),
  );
  const fill = (written: string | undefined) =>
    written === undefined ? [] : [fillParts(state, content, written)];
  return {
    kind: "story",
    title,
    reportedHeading,
    happenedHeading,
    reported: told.flatMap((e) => fill(e.reported)),
    happened: told.flatMap((e) => fill(e.happened)),
  };
}

/** The formal hierarchy, the same in every deal. */
function toOrgChart(content: Content): ChartEntry[] {
  return content.characters.map((c) => ({
    name: c.name,
    title: c.title,
    reportsTo:
      content.characters.find((m) => m.id === c.reportsTo)?.name ?? null,
  }));
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
        from: n.from,
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
      const sources = step.sources.map((id) => personOf(content, id));
      return {
        kind: "find-out",
        title: method.title,
        prompt: sayPeople(method.prompt, {
          "{source}": calledBy(content, sources[0]?.id ?? ""),
        }),
        sources,
        subjects: content.characters.map((c) => personOf(content, c.id)),
      };
    }
    case "claim": {
      const claim = state.claims[step.index];
      if (!claim) throw new Error(`Unknown claim ${String(step.index)}.`);
      return {
        kind: "claim",
        title: sayPeople(content.ui.claimTitle, {
          "{source}": calledBy(content, claim.source),
        }),
        text: claim.text,
      };
    }
    case "move": {
      const move = content.moves.find((m) => m.id === step.id);
      if (!move) throw new Error(`Unknown Move "${step.id}".`);
      return {
        kind: "move",
        from: move.from,
        title: move.title,
        body: fillParts(state, content, move.body),
      };
    }
    case "story":
      return toStoryView(state, content);
    case "results":
      return toResultsView(state, content);
    case "actions":
    case "notice":
      return step;
  }
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
      marks: content.characters.map((c) => ({
        ...personOf(content, c.id),
        mark: state.marks[c.id] ?? null,
      })),
    },
    project: toProjectView(state, content),
    openDemands: state.openDemands.flatMap(({ id, month }) => {
      const item = everyDemand(content).find((d) => d.id === id);
      return item ? [{ month, subject: item.subject }] : [];
    }),
    finalWarning: state.finalWarning,
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
    orgChart: toOrgChart(content),
    hotspots: actionsThisMonth(state, content).map((a) =>
      toHotspot(state, content, a),
    ),
    step: toStepView(state, world),
    hint: content.ui.hints[state.step.kind].replaceAll(
      "{actions}",
      actionsLabel,
    ),
    choices: legalChoices(state, world),
  });
}

function buzzwordsOf(content: Content, ids: readonly string[]): Buzzword[] {
  return content.buzzwords.filter((b) => ids.includes(b.id));
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
