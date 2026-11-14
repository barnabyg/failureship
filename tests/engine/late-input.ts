import { gameContent } from "../../src/content";
import { startRun, type PlayerView, type Run } from "../../src/engine";

/** Whether this seed's report input is late in this month, whatever you did. */
export function isLate(run: Run, month: number): boolean {
  let view = run.view();
  while (view.month < month) {
    const next = view.choices.at(-1);
    if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(next);
  }
  const notified = (v: PlayerView) =>
    v.step.kind === "notification" && v.step.id === "report-input-late";
  while (view.month === month && view.step.kind === "notification") {
    if (notified(view)) return true;
    const free = view.step.options.find((o) => o.costLabel === "Costs nothing");
    if (free === undefined || view.step.id === "monthly-report") return false;
    view = run.choose({
      type: "notification",
      notificationId: view.step.id,
      optionId: free.id,
    });
  }
  return false;
}

/** Whether the report's input is late in month 2, read as the player would. */
export function lateInMonthTwo(seed: number) {
  return isLate(startRun({ seed, content: gameContent }), 2);
}
