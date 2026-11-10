import { gameContent } from "../../src/content";
import {
  startRun,
  type Choice,
  type Kind,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";

const bossKind = (run: Run) =>
  readHiddenTruth(run).characters.find((c) => c.id === "boss")?.kind as Kind;

/** Plays for nothing until the given Notification arrives. */
export function reach(run: Run, notificationId: string): PlayerView {
  let view = run.view();
  while (view.step.kind !== "results") {
    const { step } = view;
    if (step.kind === "notification" && step.id === notificationId) return view;
    const free =
      step.kind === "notification"
        ? step.options.find((o) => o.costLabel === "Costs nothing")
        : undefined;
    const next: Choice | undefined =
      step.kind === "notification" && free
        ? { type: "notification", notificationId: step.id, optionId: free.id }
        : view.choices[0];
    if (!next) throw new Error(`Stuck at ${step.kind}.`);
    view = run.choose(next);
  }
  throw new Error(`Never reached ${notificationId}.`);
}

/** The same Budget choice, for one seed: what the boss made of it. */
export function decide(seed: number, notificationId: string, optionId: string) {
  const run = startRun({ seed, content: gameContent });
  reach(run, notificationId);
  const before = readHiddenTruth(run).bossBelief;
  const { result } = run.choose({
    type: "notification",
    notificationId,
    optionId,
  });
  if (result?.kind !== "answer") throw new Error(result?.kind);
  return {
    kind: bossKind(run),
    shift: readHiddenTruth(run).bossBelief - before,
    reaction: result.then.reaction,
  };
}

export const DECISIONS = [
  ["bonus-pot", ["bonus-allies", "bonus-workers", "bonus-boss", "bonus-split"]],
  [
    "underspend",
    ["underspend-chairs", "underspend-project", "underspend-return"],
  ],
] as const;
