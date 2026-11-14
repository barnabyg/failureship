import { startRun, type Content, type PlayerView } from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { calledAtStart } from "./fixture";
import { behavioursIn } from "./scene-view";

export const KINDS = ["believer", "incompetent", "practitioner"] as const;

export function sceneOf(view: PlayerView) {
  if (view.step.kind !== "scene") throw new Error(view.step.kind);
  return view.step;
}

export function openMeeting(seed: number, content: Content) {
  const run = startRun({ seed, content });
  let view = run.view();
  while (view.step.kind !== "actions") {
    const choice = view.choices[0];
    if (!choice) throw new Error("Stuck before the meeting.");
    view = run.choose(choice);
  }
  return {
    run,
    step: sceneOf(run.choose({ type: "action", actionId: "meeting" })),
  };
}

/** How often each kind shows each behaviour, across many deals. */
export function tally(content: Content, seeds = 3000) {
  const counts = new Map(
    content.behaviours.map((b) => [
      b.text,
      { believer: 0, incompetent: 0, practitioner: 0 },
    ]),
  );
  const totals = { believer: 0, incompetent: 0, practitioner: 0 };
  for (let seed = 1; seed <= seeds; seed++) {
    const { run, step } = openMeeting(seed, content);
    const { characters } = readHiddenTruth(run);
    for (const { who, text } of behavioursIn(step, content)) {
      const known = content.characters.find(
        (c) => calledAtStart(content, c.id) === who,
      );
      const kind = characters.find((c) => c.id === known?.id)?.kind;
      const count = counts.get(text.replace(new RegExp(who, "gi"), "{who}"));
      if (!kind || !count) throw new Error(`Unknown sign: ${text}`);
      count[kind] += 1;
      totals[kind] += 1;
    }
  }
  return { counts, totals };
}
