import { gameContent } from "../../src/content";
import type { Choice, PlayerView, Run } from "../../src/engine";
import { everyNotification } from "../../src/engine/content";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { calledBy } from "../../src/engine/say";
import type { State } from "../../src/engine/state";
import { plainChoice } from "../../src/ui/later-month";
import type { Otherwise } from "./real-runs";

/**
 * Scripted players for the balance tests, each a way of choosing whatever a
 * climber's script leaves open: on principle, at random, or by reading people.
 */

const notifications = everyNotification(gameContent);

/** The family of Move a choice is, as written in the data, if it has one. */
function familyOf(choice: Choice): string | undefined {
  if (choice.type === "notification") {
    return notifications
      .find((n) => n.id === choice.notificationId)
      ?.options.find((o) => o.id === choice.optionId)?.family;
  }
  if (choice.type === "scene") {
    return gameContent.scenes
      .find((s) => s.id === choice.sceneId)
      ?.options.find((o) => o.id === choice.optionId)?.family;
  }
  return undefined;
}

/** The families a player without scruples reaches for, first choice first. */
const AMORAL = ["fabricate", "attack", "deflect"];

/** Takes the amoral choice each time there is one, and plays plainly otherwise. */
export const amoral: Otherwise = (view) => {
  const ranked = view.choices
    .map((choice) => ({ choice, at: AMORAL.indexOf(familyOf(choice) ?? "") }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at);
  return ranked[0]?.choice ?? plainChoice(view);
};

/** Clicks about: whatever is on offer, by a fixed rule from the seed and the step. */
export function clicksAbout(seed: number): Otherwise {
  let turn = 0;
  return (view) => {
    turn += 1;
    return (
      view.choices[(seed * 7 + turn * 3) % view.choices.length] ??
      plainChoice(view)
    );
  };
}

const byName = new Map(gameContent.characters.map((c) => [c.name, c.id]));

/** Whom a choice has a word with about an open seat, if anyone. */
function approachedBy(view: PlayerView, choice: Choice): string | undefined {
  if (choice.type !== "notification") return undefined;
  const approach = notifications
    .find((n) => n.id === choice.notificationId)
    ?.options.find((o) => o.id === choice.optionId)?.seat?.approach;
  // Your boss's boss is whoever the Org Chart says, as the player reads it.
  if (approach === "{head}") {
    const head = view.orgChart.find((e) =>
      e.title.endsWith("your boss's boss"),
    );
    return head ? byName.get(head.name) : undefined;
  }
  return approach;
}

/** The words with someone about the seat that this step offers. */
const approaches = (view: PlayerView) =>
  view.choices.filter((c) => approachedBy(view, c) !== undefined);

/** Has a word about each open seat with one of those on offer, picked at random. */
export function guessesWhomToAsk(seed: number): Otherwise {
  let turn = 0;
  return (view) => {
    turn += 1;
    const open = approaches(view);
    return (
      open[(seed * 13 + turn) % Math.max(open.length, 1)] ?? plainChoice(view)
    );
  };
}

/** Has a word about each open seat with whoever really decides it, or their sway. */
export const knowsThePowerMap: Otherwise = (view, run) => {
  const truth = readHiddenTruth(run);
  const seat = truth.vacancies.find((v) => v.decided === null);
  const decider = seat ? (seat.patron ?? seat.holder) : undefined;
  const sways = (who: string | undefined) =>
    who === decider ||
    truth.powerMap.influence.some((i) => i.who === who && i.over === decider);
  return (
    approaches(view).find((c) => sways(approachedBy(view, c))) ??
    plainChoice(view)
  );
};

const escaped = (text: string) => text.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

/** Each Scene's signs, as patterns that give back who was put in each part. */
const signs = new Map(
  gameContent.scenes.map((scene) => [
    scene.id,
    scene.signs.map(({ text }) => {
      const parts: string[] = [];
      const pattern = escaped(text).replace(
        /\{(holder|ignored|bystander)\}/g,
        (_, part: string) => {
          parts.push(part);
          return "(.+?)";
        },
      );
      return { pattern: new RegExp(`^${pattern}$`, "i"), parts };
    }),
  ]),
);

/** How much each part of a sign says about someone's standing in the room. */
const STANDING: Record<string, number> = {
  holder: 2,
  bystander: 1,
  ignored: -2,
};

/**
 * A careful reader of the room, who keeps a tally of who holds the floor in
 * every Scene's signs, from what is shown and nothing else, and has a word
 * about each open seat with whoever has held it most.
 */
export function readsTheRoom() {
  const tally = new Map<string, number>();
  const watch = (view: PlayerView, run: Run) => {
    const { step } = view;
    if (step.kind !== "scene") return;
    const { state } = JSON.parse(run.save()) as { state: State };
    const called = new Map(
      gameContent.characters.map((c) => [
        calledBy(state, gameContent, c.id).toLowerCase(),
        c.id,
      ]),
    );
    for (const { text } of step.signs) {
      for (const { pattern, parts } of signs.get(step.id) ?? []) {
        const found = pattern.exec(text);
        if (!found) continue;
        parts.forEach((part, i) => {
          const who = called.get(found[i + 1]?.toLowerCase() ?? "");
          if (who)
            tally.set(who, (tally.get(who) ?? 0) + (STANDING[part] ?? 0));
        });
        break;
      }
    }
  };
  const standing = (view: PlayerView, choice: Choice) =>
    tally.get(approachedBy(view, choice) ?? "") ?? 0;
  const otherwise: Otherwise = (view) =>
    approaches(view).sort((a, b) => standing(view, b) - standing(view, a))[0] ??
    plainChoice(view);
  return { otherwise, watch };
}
