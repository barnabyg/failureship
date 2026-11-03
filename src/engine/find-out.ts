import { makeClaim, verdictOfClaim } from "./claims";
import type { Content } from "./content";
import { methodOf, sourcesHere } from "./reads";
import { pick } from "./rng";
import { calledBy, capitalised } from "./say";
import { IllegalChoiceError, type State, type Step } from "./state";
import type { Choice } from "./view";

/** Who is there to ask: whoever happens to be there, or a choice of them. */
export function arriveToFindOut(
  state: State,
  content: Content,
  id: string,
): Step {
  const method = methodOf(content, id);
  const sources = sourcesHere(state, method.sources);
  if (!method.someoneThere) {
    return { kind: "find-out", method: id, sources };
  }
  const there = pick(state.rng, sources);
  state.rng = there.next;
  return { kind: "find-out", method: id, sources: [there.item] };
}

export function hearClaim(
  state: State,
  content: Content,
  choice: Extract<Choice, { type: "find-out" }>,
): void {
  if (state.step.kind !== "find-out") {
    throw new IllegalChoiceError(choice.sourceId);
  }
  const made = makeClaim(state.rng, content, {
    month: state.month,
    method: methodOf(content, state.step.method),
    source: choice.sourceId,
    subject: choice.subjectId,
    sourceCalled: calledBy(state, content, choice.sourceId),
    characters: state.truth.characters,
    powerMap: state.truth.powerMap,
  });
  state.rng = made.next;
  state.claims.push(made.claim);
  state.clues.push({
    month: state.month,
    source: capitalised(calledBy(state, content, made.claim.source)),
    text: made.claim.text,
    verdict: verdictOfClaim(content, made.claim),
  });
  const { factId, subject } = made.claim;
  if (factId !== null) {
    state.heard = state.heard.filter((h) => h.fact !== factId);
    state.heard.push({ fact: factId, subject });
  }
  state.step = { kind: "claim", index: state.claims.length - 1 };
}
