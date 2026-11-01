import { chasedIdOf, everyNotification } from "./content";
import { arriveToFindOut, hearClaim } from "./find-out";
import { leaveStory, nextStep } from "./month";
import { applyOutcome, countMove } from "./outcome";
import { goOverHead } from "./over-head";
import { costOf, inTurn } from "./reads";
import { drawFor } from "./rng";
import { behaveInScene, openScene } from "./scenes";
import { IllegalChoiceError, type State, type World } from "./state";
import type { Choice } from "./view";

/** Carries out a choice already known to be legal. */
export function applyChoice(state: State, world: World, choice: Choice): void {
  const { content } = world;
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
        state.step = openScene(state, world, action.scene);
      } else if (action.findOut !== undefined) {
        state.step = arriveToFindOut(state, content, action.findOut);
      } else if (action.overHead) {
        state.step = goOverHead(state, content, action.label);
      } else if (action.result) {
        const results = [action.result, ...action.moreResults];
        const result = inTurn(results, state.month);
        state.step = { kind: "notice", ...(result ?? action.result), reaction };
      }
      return;
    }
    case "find-out":
      hearClaim(state, content, choice);
      return;
    case "scene":
      behaveInScene(state, world, choice);
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

  countMove(state, option.family);
  state.spent += costOf(content, option.cost);
  state.unanswered = state.unanswered.filter(
    (id) => id !== choice.notificationId,
  );
  const learned = option.learns.filter((w) => !state.buzzwords.includes(w));
  state.buzzwords.push(...learned);
  const lost =
    option.bet &&
    drawFor(state.seed, option.id, state.month) >= option.bet.chance
      ? option.bet.lost
      : undefined;
  const outcome = lost ?? option;
  const reaction = applyOutcome(state, content, outcome, option.label);

  if (option.dialog !== undefined) {
    state.step = { kind: "dialog", id: option.dialog, learned, reaction };
  } else if (outcome.result) {
    state.step = { kind: "notice", ...outcome.result, reaction };
  } else {
    state.step = nextStep(state, world);
  }
}
