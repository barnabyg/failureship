import type { Content, StepView } from "../../src/engine";
import { calledAtStart } from "./fixture";

/** Reads of a Scene as the player sees it, one row to each person present. */
type SceneView = Extract<StepView, { kind: "scene" }>;

/** Everyone in the room, by name and title, in the order of the rows. */
export function castOf(scene: SceneView) {
  return scene.people.map(({ name, title }) => ({ name, title }));
}

/** How the boss, or the boss's boss, is with the player, if they are there. */
export function treatmentOf(
  scene: SceneView,
  place: "boss" | "head" = "boss",
): string | null {
  return scene.people.find((p) => p.place === place)?.withYou ?? null;
}

/** How everyone else present is with the player. */
export function regardIn(scene: SceneView) {
  return scene.people.flatMap((p) =>
    p.place === null && p.withYou !== null
      ? [{ who: p.name, text: p.withYou }]
      : [],
  );
}

/**
 * What everyone was seen doing: by name, or, given the content, by how the
 * text calls them while the bosses are where a run starts them.
 */
export function behavioursIn(scene: SceneView, content?: Content) {
  const called = (name: string) => {
    const id = content?.characters.find((c) => c.name === name)?.id;
    return content === undefined || id === undefined
      ? name
      : calledAtStart(content, id);
  };
  return scene.people.flatMap((p) =>
    p.behaviour === null ? [] : [{ who: called(p.name), text: p.behaviour }],
  );
}

/** Every sign of What you notice: those about several people, then each row's. */
export function everySign(scene: SceneView) {
  return [...scene.signs, ...scene.people.flatMap((p) => p.signs)];
}
