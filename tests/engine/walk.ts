import { gameContent } from "../../src/content";
import { startRun, type Content, type PlayerView } from "../../src/engine";
import type { State } from "../../src/engine/state";
import { calledBy } from "../../src/engine/say";

/**
 * Walks a whole run, with a pick made from what is on offer at each step. At
 * each Scene it notes whom each Character is called, as things stand.
 */
export function walk(
  seed: number,
  pickFrom: (view: PlayerView, turn: number) => PlayerView["choices"][number],
  content: Content = gameContent,
) {
  const run = startRun({ seed, content });
  const views = [run.view()];
  const named = new Map<PlayerView, Map<string, string>>();
  let view = views[0] as PlayerView;
  for (let turn = 0; view.choices.length > 0; turn++) {
    view = run.choose(pickFrom(view, turn));
    views.push(view);
    if (view.step.kind === "scene") {
      const { state } = JSON.parse(run.save()) as { state: State };
      named.set(
        view,
        new Map(
          content.characters.map((c) => [
            calledBy(state, content, c.id).toLowerCase(),
            c.id,
          ]),
        ),
      );
    }
  }
  return { run, views, named };
}

/** Answers for nothing, so as to keep an action for the meeting room, and goes. */
export function attendsEverything(view: PlayerView, turn: number) {
  const { step } = view;
  const free =
    step.kind === "notification"
      ? step.options.find((o) => o.costLabel === "Costs nothing")
      : undefined;
  if (step.kind === "notification" && free) {
    return {
      type: "notification" as const,
      notificationId: step.id,
      optionId: free.id,
    };
  }
  const meeting = view.choices.find(
    (c) => c.type === "action" && c.actionId.startsWith("meeting"),
  );
  const choice = meeting ?? view.choices[turn % view.choices.length];
  if (!choice) throw new Error("No choice.");
  return choice;
}
