import { gameContent } from "../content";
import type { Choice, PlayerView, Run } from "../engine";

/**
 * One step of the plain player in the browser tests' helpers: files the report,
 * says no to the rest, goes to the meeting, and spends what is left on the work.
 */
export function plainChoice(view: PlayerView): Choice {
  const { step, choices } = view;
  if (step.kind === "notification") {
    const option =
      step.options.find((o) => o.id === "report") ??
      step.options.find(
        (o) => o.affordable && o.costLabel === gameContent.ui.freeLabel,
      );
    if (option) {
      return {
        type: "notification",
        notificationId: step.id,
        optionId: option.id,
      };
    }
  }
  if (step.kind === "scene" && step.options[0]) {
    return { type: "scene", sceneId: step.id, optionId: step.options[0].id };
  }
  const action = (wanted: (id: string) => boolean) =>
    choices.find((c) => c.type === "action" && wanted(c.actionId));
  const next =
    action((id) => id.startsWith("meeting")) ??
    choices.find((c) => c.type === "continue") ??
    action((id) => id === "work");
  if (!next) throw new Error(`Later-month start stuck at ${step.kind}.`);
  return next;
}

/** Plays a new run on to the start of the month written, if there is such a month. */
export function playToMonth(run: Run, written: string | null): PlayerView {
  const month = Number(written);
  let view = run.view();
  if (!Number.isInteger(month) || month > view.totalMonths) return view;
  while (view.month < month && view.choices.length > 0) {
    view = run.choose(plainChoice(view));
  }
  return view;
}
