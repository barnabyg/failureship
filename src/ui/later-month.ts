import { gameContent } from "../content";
import type { Choice, Content, PlayerView, Run } from "../engine";

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
    action((id) => id.startsWith("work"));
  if (!next) throw new Error(`Later-month start stuck at ${step.kind}.`);
  return next;
}

/**
 * Plays a new run on to the start of the month written, if there is such a month.
 * On the way it takes each option named in `choose`, a comma-separated list, the
 * first time that option is offered after the one before it, and plays plainly
 * otherwise.
 */
export function playToMonth(
  run: Run,
  written: string | null,
  choose: string | null = null,
): PlayerView {
  const month = Number(written);
  let view = run.view();
  if (!Number.isInteger(month) || month > view.totalMonths) return view;
  const toChoose = choose ? choose.split(",") : [];
  while (view.month < month && view.choices.length > 0) {
    const named = view.choices.find(
      (c) => "optionId" in c && c.optionId === toChoose[0],
    );
    if (named) toChoose.shift();
    view = run.choose(named ?? plainChoice(view));
  }
  if (toChoose[0] !== undefined) {
    throw new Error(`Later-month start was never offered "${toChoose[0]}".`);
  }
  return view;
}

/**
 * The content, with the run ending as the month written closes, if that is a
 * month before the run's own last, so that a test of the results screen need
 * not walk the months after what it tests. Otherwise the content as it is.
 */
export function endingAt(content: Content, written: string | null): Content {
  const month = Number(written);
  const { monthsPerRun } = content.balance;
  if (written === null || !Number.isInteger(month)) return content;
  if (month < 1 || month >= monthsPerRun) return content;
  return { ...content, balance: { ...content.balance, monthsPerRun: month } };
}
