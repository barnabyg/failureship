import { chasedIdOf, everyNotification } from "./content";
import { replyToDeal } from "./deals";
import { arriveToFindOut, hearClaim } from "./find-out";
import { hearOfPlan } from "./grand-plans";
import { leaveStory, nextStep } from "./month";
import { applyOutcome, countMove } from "./outcome";
import { goOverHead } from "./over-head";
import { replyToPromise } from "./promises";
import { costOf, inTurn } from "./reads";
import { drawFor } from "./rng";
import { behaveInScene, openScene } from "./scenes";
import {
  IllegalChoiceError,
  type Result,
  type State,
  type World,
} from "./state";
import type { Choice } from "./view";

/** Carries out a choice already known to be legal. */
export function applyChoice(state: State, world: World, choice: Choice): void {
  const { content } = world;
  // A result is read by the time the player does something else.
  state.result = null;
  switch (choice.type) {
    case "notification":
      answerNotification(state, world, choice);
      return;
    case "action": {
      const action = content.actions.find((a) => a.id === choice.actionId);
      if (!action) throw new IllegalChoiceError(choice.actionId);
      state.spent += costOf(content, action.cost);
      state.visited.push(action.id);
      countMove(state, action.family);
      const reaction = applyOutcome(state, content, action, action.label);
      if (action.scene !== undefined) {
        const scene = openScene(state, world, action.scene);
        state.step = { ...scene, action: action.id };
      } else if (action.findOut !== undefined) {
        const findOut = arriveToFindOut(state, content, action.findOut);
        state.step = { ...findOut, action: action.id };
      } else if (action.overHead) {
        const result = goOverHead(state, content, action.label);
        setAside(state, world, { ...result, action: action.id });
      } else if (action.result) {
        const results = [action.result, ...action.moreResults];
        const { title, body } = inTurn(results, state.month) ?? action.result;
        setAside(state, world, {
          kind: "happened",
          title,
          body,
          reaction,
          action: action.id,
        });
      }
      return;
    }
    case "find-out":
      setAside(state, world, hearClaim(state, content, choice));
      return;
    case "scene":
      setAside(state, world, behaveInScene(state, world, choice));
      return;
    case "continue":
      if (state.step.kind === "story") leaveStory(state, world);
      else state.step = nextStep(state, world);
      return;
  }
}

function answerNotification(
  state: State,
  world: World,
  choice: Extract<Choice, { type: "notification" }>,
): void {
  const { content } = world;
  const option = everyNotification(content)
    .find((n) => n.id === choice.notificationId)
    ?.options.find((o) => o.id === choice.optionId);
  if (!option) throw new IllegalChoiceError(choice.optionId);
  state.openDemands = state.openDemands.filter(
    (d) =>
      d.id !== choice.notificationId &&
      chasedIdOf(d.id) !== choice.notificationId,
  );
  if (option.stalls) {
    state.openDemands.push({
      id: choice.notificationId,
      month: state.month,
      chased: false,
    });
  }

  hearOfPlan(state, content, choice.notificationId);
  countMove(state, option.family);
  state.spent += costOf(content, option.cost);
  state.unanswered = state.unanswered.filter(
    (id) => id !== choice.notificationId,
  );
  const learned = option.learns.filter((w) => !state.buzzwords.includes(w));
  const lost =
    option.bet &&
    drawFor(state.seed, option.id, state.month) >= option.bet.chance
      ? option.bet.lost
      : undefined;
  const outcome = lost ?? option;
  const reaction = applyOutcome(
    state,
    content,
    {
      ...outcome,
      learns: option.learns,
      settlesDue: outcome.settles && {
        id: choice.notificationId,
        how: outcome.settles,
      },
    },
    option.label,
  );

  const reply =
    replyToPromise(state, content, option.promise) ??
    replyToDeal(state, content, option.deal);
  const then: Told | null = reply
    ? { kind: "notice", ...reply, reaction }
    : option.dialog !== undefined
      ? { kind: "dialog", id: option.dialog, learned, reaction }
      : outcome.result
        ? { kind: "notice", ...outcome.result, reaction }
        : null;
  if (then) {
    const { notificationId, optionId } = choice;
    setAside(state, world, { kind: "answer", notificationId, optionId, then });
  } else {
    state.step = nextStep(state, world);
  }
}

type Told = Extract<Result, { kind: "answer" }>["then"];

/**
 * Keeps what a choice led to beside whatever comes next, which follows at once.
 * Anything that changes the job, or ends the run, is told before anything else.
 */
function setAside(state: State, world: World, result: Result): void {
  state.result = result;
  state.step = nextStep(state, world);
}
