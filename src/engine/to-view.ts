import {
  everyBill,
  everyDemand,
  everyNotification,
  type Condition,
  type Content,
} from "./content";
import {
  actionsThisMonth,
  costOf,
  coverForGone,
  fillParts,
  fillSubject,
  isDone,
  isMet,
  matches,
  methodOf,
  namedBy,
  offeredOptions,
  optionsOnOffer,
  personOf,
  remaining,
} from "./reads";
import { YOU } from "./deal";
import { dealsInView } from "./deals";
import {
  escapesInStory,
  escapesInView,
  escapesOnOffer,
  inboxEscapes,
} from "./escapes";
import { floorNow, isOn } from "./floors";
import { gaugesInView, gaugesThisMonth } from "./gauges";
import {
  bossesOf,
  inChartOrder,
  isGone,
  managerOf,
  placeAmong,
} from "./places";
import { promisesInView } from "./promises";
import { COMPETITOR } from "./rivals";
import { sceneData } from "./scenes";
import { calledBy, sayFrom, sayPeople, titleOf } from "./say";
import { standingInView } from "./standing";
import { planInView } from "./grand-plans";
import { answerable, canTakeNow, inboxMail, onTheFloor } from "./month";
import type { Landing, Notice, Result, State, Step, World } from "./state";
import { toResultsView } from "./to-results";
import { toWinView } from "./win";
import type {
  Buzzword,
  ChartEntry,
  DialogView,
  Choice,
  Hotspot,
  NotificationOption,
  PlayerView,
  ResultView,
  StepView,
  EscapeView,
  InboxItemView,
  LandedView,
  MailView,
  NoticeView,
} from "./view";

/** The Escapes on offer from one consequence, as choices. */
function escapeChoices(state: State, content: Content, id: string): Choice[] {
  return escapesOnOffer(state, content, id).map((e) => ({
    type: "escape",
    billId: id,
    escapeId: e.id,
  }));
}

/** The answers that can be given to one Notification, as choices. */
function answerChoices(state: State, content: Content, id: string): Choice[] {
  return notificationOptions(state, content, id)
    .filter((o) => o.affordable)
    .map((o) => ({ type: "notification", notificationId: id, optionId: o.id }));
}

/** The floor's actions that can be taken now. */
function actionChoices(state: State, content: Content): Choice[] {
  return actionsThisMonth(state, content)
    .filter((a) => canTakeNow(state, content, a))
    .map((a) => ({ type: "action", actionId: a.id }));
}

/**
 * On the floor: whatever the inbox holds, in its order, so that the top of
 * the inbox comes first, and then the floor's actions.
 */
function floorChoices(state: State, content: Content): Choice[] {
  return [
    ...inboxEscapes(state, content).flatMap((id) =>
      escapeChoices(state, content, id),
    ),
    ...inboxMail(state, content).flatMap((id) =>
      answerChoices(state, content, id),
    ),
    ...actionChoices(state, content),
  ];
}

export function legalChoices(state: State, world: World): Choice[] {
  const { content } = world;
  const { step } = state;
  if (onTheFloor(state, content)) return floorChoices(state, content);
  switch (step.kind) {
    case "notification":
    case "actions":
      return floorChoices(state, content);
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
    case "escape":
      return escapeChoices(state, content, step.id);
    case "notice":
    case "story":
    case "win":
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
  const behaviourOf = (character: string) => {
    const seen = shown.find((s) => s.character === character);
    if (seen === undefined) return null;
    const written = [
      ...content.behaviours,
      ...(content.changing?.whistleblower.signs ?? []),
    ].find((b) => b.id === seen.behaviour);
    const who = calledBy(state, content, character);
    return sayPeople(written?.text ?? "", { "{who}": who });
  };
  // A sign that names only one person in the room is about them.
  const signs = scene.signs.map((s) => {
    const named = [
      ...namedBy(state, content, s.text, scene.cast, misleading),
      ...(s.competing === undefined ? [] : [s.competing]),
    ].filter((c) => scene.cast.includes(c));
    const only = new Set(named).size === 1 ? named[0] : undefined;
    return {
      label: s.label,
      text: fillParts(state, content, s.text, scene.cast, misleading),
      about: only,
    };
  });
  const { boss, head } = bossesOf(state, content);
  const withYouOf = (character: string) => {
    const regarded = regard.find((r) => r.character === character);
    const written =
      character === boss
        ? content.boss.signs.find((s) => s.id === treatment)
        : character === head
          ? content.overHead?.signs.find((s) => s.id === headTreatment)
          : content.reputation?.signs.find((s) => s.id === regarded?.sign);
    if (written === undefined || written.plain) return null;
    const who = calledBy(state, content, character);
    return sayPeople(written.text, { "{who}": who });
  };
  return {
    kind: "scene",
    id: scene.id,
    title: scene.title,
    location: scene.location,
    narration: scene.narration.map(fill),
    people: inRowOrder(state, content, scene.cast).flatMap((c) =>
      content.characters
        .filter((x) => x.id === c)
        .map((x) => ({
          name: x.name,
          title: titleOf(state, content, x.id),
          place: placeAmong({ boss, head }, x.id) ?? null,
          behaviour: behaviourOf(x.id),
          withYou: withYouOf(x.id),
          signs: signs.filter((s) => s.about === x.id).map(asSign),
        })),
    ),
    signs: signs.filter((s) => s.about === undefined).map(asSign),
    options: offeredOptions(state, content, scene).map((o) => ({
      id: o.id,
      label: fillSubject(state, content, o.about, fill(o.label)),
      stakes: o.stakes,
    })),
  };
}

function asSign({ label, text }: { label: string; text: string }) {
  return { label, text };
}

/** Whoever is in the room, the bosses first and then as the Org Chart has them. */
function inRowOrder(
  state: State,
  content: Content,
  room: readonly string[],
): string[] {
  const { boss, head } = bossesOf(state, content);
  const bosses = [head, boss].filter((id) => id !== undefined);
  return [
    ...bosses,
    ...inChartOrder(state, content).filter((id) => !bosses.includes(id)),
  ].filter((id) => room.includes(id));
}

/** The flags a condition needs to be set, leaving out any it needs unset. */
function flagsNamed(condition: Condition): string[] {
  if ("flag" in condition) return [condition.flag];
  if ("all" in condition) return condition.all.flatMap(flagsNamed);
  if ("any" in condition) return condition.any.flatMap(flagsNamed);
  return [];
}

/**
 * When in the month a thing told happened: as its first flag was set. The
 * month's own line comes first, and anything with no flag of its own, such as
 * a meeting missed, last, as the month closes.
 */
function whenInMonth(state: State, flags: readonly string[] | null): number {
  if (flags === null) return -1;
  const set = flags
    .map((flag) => state.flags.indexOf(flag))
    .filter((at) => at >= 0);
  return set.length === 0 ? state.flags.length : Math.min(...set);
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
    .flatMap(({ id }) => content.events.filter((e) => e.id === id));
  const things = [
    ...events.map((e) => ({ story: e.story, flags: e.sets })),
    ...told.map((e) => ({
      story: e,
      // The month's own line, with nothing the player did behind it, opens.
      flags: e.when === undefined ? null : flagsNamed(e.when),
    })),
  ];
  return {
    kind: "story",
    title: title.replaceAll("{job}", floorNow(state, content).title),
    landed: state.landed.map((landing) =>
      toLandedView(state, content, landing),
    ),
    reportedHeading,
    happenedHeading,
    // Both lines of a pair come from the same written thing, never matched up later.
    pairs: things
      .map((thing) => ({ ...thing, at: whenInMonth(state, thing.flags) }))
      .sort((a, b) => a.at - b.at)
      .map(({ story }) => ({
        reported: fill(story.reported),
        happened: fill(story.happened),
      }))
      .concat(escapesInStory(state, content)),
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
    case "notification":
      return {
        ...toMailView(state, content, step.id),
        waiting: answerable(state, content).filter((id) => id !== step.id)
          .length,
      };
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
    case "escape":
      return toEscapeView(state, content, step.id);
    case "story":
      return toStoryView(state, content);
    case "win":
      return toWinView(state, content);
    case "results":
      return toResultsView(state, content);
    case "notice":
      return toNoticeView(step);
    case "actions":
      return step;
  }
}

/** A notice as the player reads it. Whether it was urgent is the engine's business. */
function toNoticeView(notice: Notice): NoticeView {
  const { title, body, reaction, verdict, decided } = notice;
  return { kind: "notice", title, body, reaction, verdict, decided };
}

/** A consequence of the player's own doing, and the ways out of it. */
function toEscapeView(state: State, content: Content, id: string): EscapeView {
  const bill = everyBill(content).find((b) => b.id === id);
  if (!bill) throw new Error(`Unknown Bill "${id}".`);
  return {
    kind: "escape",
    id: bill.id,
    from: sayFrom(state, content, bill.from ?? ""),
    title: bill.title,
    body: fillParts(state, content, bill.body),
    escapes: escapesInView(state, content, bill.id).map(
      ({ escape, needs }) => ({ id: escape.id, label: escape.label, needs }),
    ),
  };
}

/** What landed as the month closed, as the official story tells it. */
function toLandedView(
  state: State,
  content: Content,
  landing: Landing,
): LandedView {
  switch (landing.kind) {
    case "move": {
      const move = [...content.moves, ...everyBill(content)].find(
        (m) => m.id === landing.id,
      );
      if (!move) throw new Error(`Unknown Move "${landing.id}".`);
      const body = sayPeople(move.body, {
        [COMPETITOR]:
          landing.by === undefined ? "" : calledBy(state, content, landing.by),
      });
      return {
        kind: "move",
        from: sayFrom(state, content, move.from ?? ""),
        title: move.title,
        body: fillParts(state, content, body),
      };
    }
    case "event": {
      const event = content.events.find((e) => e.id === landing.id);
      if (!event) throw new Error(`Unknown Company Event "${landing.id}".`);
      return {
        kind: "event",
        from: sayFrom(state, content, event.from),
        title: event.title,
        body: event.body,
      };
    }
    case "notice":
      return toNoticeView(landing);
  }
}

/** The step, with whoever covers for anyone who has gone written in their place. */
function shownStep(state: State, world: World): StepView {
  const { content } = world;
  const step = toStepView(state, world);
  const asWritten = state.step.kind === "notice" && state.step.asWritten;
  if (step.kind === "results" || asWritten) return step;
  if (step.kind === "story") {
    return {
      ...coverForGone(state, content, step),
      landed: state.landed.map((landing, i) => {
        const shown = step.landed[i] ?? toLandedView(state, content, landing);
        return landing.kind === "notice" && landing.asWritten
          ? shown
          : coverForGone(state, content, shown);
      }),
    };
  }
  return coverForGone(state, content, step);
}

/**
 * What waits in the inbox: consequences to escape, then e-mail, in the order
 * they came, and then what the month's opening told, only to read.
 */
function toInbox(state: State, content: Content): PlayerView["inbox"] {
  const over = ["story", "win", "results"].includes(state.step.kind);
  if (over) return { items: [], toAnswer: 0 };
  const items: InboxItemView[] = [
    ...inboxEscapes(state, content).map((id) =>
      toEscapeView(state, content, id),
    ),
    ...inboxMail(state, content).map((id) => toMailView(state, content, id)),
  ].map((item) => coverForGone(state, content, item));
  const notes = state.notes.map((note) => {
    const shown = toNoticeView(note);
    return note.asWritten ? shown : coverForGone(state, content, shown);
  });
  return {
    items: [...items, ...notes],
    toAnswer:
      inboxEscapes(state, content).length + answerable(state, content).length,
  };
}

/** A Notification as it waits in the inbox. */
function toMailView(state: State, content: Content, id: string): MailView {
  return {
    kind: "notification",
    ...toMail(state, content, id),
    id,
    options: notificationOptions(state, content, id),
    short: state.mailSeen.includes(id),
  };
}

/** A Notification as an e-mail: who it is from, its subject and what it says. */
function toMail(state: State, content: Content, id: string) {
  const n = everyNotification(content).find((x) => x.id === id);
  if (!n) throw new Error(`Unknown Notification "${id}".`);
  return {
    from: sayFrom(state, content, n.from),
    subject: n.subject,
    body: n.body
      .replaceAll("{real}", statusLabel(content, state.project.real))
      .replaceAll("{reported}", statusLabel(content, state.project.reported)),
  };
}

function toDialogView(
  content: Content,
  step: Extract<
    Extract<Result, { kind: "answer" }>["then"],
    { kind: "dialog" }
  >,
): DialogView {
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

/** The place on the floor an action spent, by its label. */
function spentOn(content: Content, action: string | undefined) {
  return content.actions.find((a) => a.id === action)?.label ?? null;
}

function toResultView(
  state: State,
  content: Content,
  result: Result,
): ResultView {
  switch (result.kind) {
    case "happened": {
      const { action, ...told } = result;
      return { ...told, spent: spentOn(content, action) };
    }
    case "claim": {
      const claim = state.claims[result.index];
      if (!claim) throw new Error(`Unknown claim ${String(result.index)}.`);
      return {
        kind: "claim",
        title: sayPeople(content.ui.claimTitle, {
          "{source}": calledBy(state, content, claim.source),
        }),
        text: claim.text,
        spent: spentOn(content, result.action),
      };
    }
    case "answer": {
      const option = everyNotification(content)
        .find((n) => n.id === result.notificationId)
        ?.options.find((o) => o.id === result.optionId);
      if (!option) throw new Error(`Unknown answer "${result.optionId}".`);
      const { then } = result;
      return {
        kind: "answer",
        ...toMail(state, content, result.notificationId),
        answer: option.label,
        then: then.kind === "dialog" ? toDialogView(content, then) : then,
      };
    }
  }
}

/** The last result, with whoever covers for anyone who has gone in their place. */
function shownResult(state: State, content: Content): ResultView | null {
  const { result } = state;
  if (result === null) return null;
  return coverForGone(state, content, toResultView(state, content, result));
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
      clues: state.clues.map(({ month, source, text, about }) => ({
        month,
        source,
        text,
        about,
      })),
      unread: state.clues.length - state.cluesRead,
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
    inbox: toInbox(state, content),
    waiting: !onTheFloor(state, content),
    step: shownStep(state, world),
    result: shownResult(state, content),
    hint: hintFor(state, content).replaceAll("{actions}", actionsLabel),
    choices: legalChoices(state, world),
  });
}

/**
 * What the player can do now. On the floor with the inbox not yet clear, the
 * hint says how the month closes, and once the actions are spent, that the
 * inbox is all that holds it.
 */
function hintFor(state: State, content: Content): string {
  const { hints } = content.ui;
  const { step } = state;
  if (
    step.kind !== "notification" &&
    (step.kind === "actions" || !onTheFloor(state, content))
  ) {
    return hints[step.kind];
  }
  const toAnswer =
    inboxEscapes(state, content).length + answerable(state, content).length;
  const acting = actionsThisMonth(state, content).some((a) =>
    canTakeNow(state, content, a),
  );
  return (acting ? hints.inbox : hints.inboxOnly).replaceAll(
    "{n}",
    String(toAnswer),
  );
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
      : canTakeNow(state, content, action)
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
