import { gameContent } from "../../src/content";
import { startRun, type Choice } from "../../src/engine";
import { everyNotification } from "../../src/engine/content";
import { readHiddenTruth } from "../../src/engine/hidden-truth";

/**
 * Plays whole runs in the styles a player tends to come across in, for the
 * balance tests of how the boss takes them.
 */

export const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
export const notifications = everyNotification(gameContent);
export const costOf = (key: string | undefined) =>
  key === undefined ? 0 : (gameContent.balance.actionCosts[key] ?? 0);

/** How a player tends to come across, best liked first. */
export const STYLES = {
  straight: ["truth", "results", "plain-report", "push-back", "late-answer"],
  showy: ["theatre", "flatter", "blame"],
  useful: ["flatter", "favour", "cronyism", "hand-off", "ownership"],
} as const;
export type Style = keyof typeof STYLES;

function approachesOf(choice: Choice): (string | undefined)[] {
  if (choice.type === "notification") {
    const option = notifications
      .find((n) => n.id === choice.notificationId)
      ?.options.find((o) => o.id === choice.optionId);
    return [option?.approach];
  }
  if (choice.type === "scene") {
    const option = gameContent.scenes
      .find((s) => s.id === choice.sceneId)
      ?.options.find((o) => o.id === choice.optionId);
    return option?.results.map((r) => r.approach) ?? [];
  }
  return [];
}

export function rank(choice: Choice, style: Style): number {
  const liked: readonly string[] = STYLES[style];
  const places = approachesOf(choice)
    .map((a) => liked.indexOf(a ?? ""))
    .filter((p) => p >= 0);
  return places.length > 0 ? Math.min(...places) : liked.length;
}

/** Plays a whole run in one style, going to every meeting. */
export function playIn(seed: number, style: Style) {
  const run = startRun({ seed, content: gameContent });
  let view = run.view();
  while (view.choices.length > 0) {
    const meeting = view.choices.find(
      (c) => c.type === "action" && c.actionId.startsWith("meeting"),
    );
    const floor = view.choices.find(
      (c) =>
        c.type === "action" &&
        (style === "straight"
          ? c.actionId.startsWith("work")
          : ["kitchen", "tea-point"].includes(c.actionId)),
    );
    const best = [...view.choices].sort(
      (a, b) => rank(a, style) - rank(b, style),
    )[0];
    const next =
      view.step.kind === "actions" ? (meeting ?? floor ?? best) : best;
    if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(next);
  }
  return readHiddenTruth(run);
}
