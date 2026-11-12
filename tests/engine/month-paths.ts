import { gameContent } from "../../src/content";
import { startRun, type Choice, type PlayerView } from "../../src/engine";

/** Every way through the first month, as the views seen along each one. */
export function everyPath(seed: number): PlayerView[][] {
  const paths: PlayerView[][] = [];
  const walk = (script: Choice[]) => {
    const run = startRun({ seed, content: gameContent });
    const views = [run.view(), ...script.map((c) => run.choose(c))];
    const last = views.at(-1);
    if (last?.step.kind === "story") {
      paths.push(views);
      return;
    }
    // Every source and subject would multiply the paths and show nothing new,
    // and so would the three actions left by not filing the report, and so
    // would answering the inbox in every order: it is answered from the top.
    const step = last?.step;
    const choices =
      step?.kind === "find-out"
        ? (last?.choices.slice(0, 1) ?? [])
        : (last?.choices ?? []).filter(
            (c) =>
              !(c.type === "notification" && c.optionId === "skip") &&
              !(
                step?.kind === "notification" &&
                !(c.type === "notification" && c.notificationId === step.id)
              ),
          );
    for (const choice of choices) walk([...script, choice]);
  };
  walk([]);
  return paths;
}
