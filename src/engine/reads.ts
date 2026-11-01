import type { Condition, Content, Kind, Mood, SceneData } from "./content";
import type { PowerMap } from "./deal";
import { calledBy, sayPeople } from "./say";
import type { State, World } from "./state";

export function inMonth(
  item: { months?: number[] | undefined },
  month: number,
) {
  return item.months === undefined || item.months.includes(month);
}

export function methodOf(content: Content, id: string) {
  const method = content.sources.methods.find((m) => m.id === id);
  if (!method) throw new Error(`Unknown Find Out "${id}".`);
  return method;
}

/** Writing used in turn, so that it reads differently each month. */
export function inTurn<T>(items: readonly T[], month: number): T | undefined {
  return items[(month - 1) % items.length];
}

export function bossKindOf(state: State, content: Content): Kind {
  const dealt = state.truth.characters.find(
    (c) => c.id === content.boss.character,
  );
  if (!dealt) throw new Error("The boss was not dealt.");
  return dealt.kind;
}

export function moodOf(state: State, content: Content): Mood {
  return moodAt(state.truth.bossOpinion, content.balance.opinion);
}

export function moodAt(
  opinion: number,
  { warmAt, coldAt }: { warmAt: number; coldAt: number },
): Mood {
  if (opinion >= warmAt) return "warm";
  return opinion <= coldAt ? "cold" : "neutral";
}

export function heardAbout(state: State, fact: string | undefined) {
  return state.heard.find((h) => h.fact === fact);
}

/** Writes in whoever the player was told has this Hidden Fact. */
export function fillSubject(
  state: State,
  content: Content,
  fact: string | undefined,
  written: string,
): string {
  const heard = heardAbout(state, fact);
  return sayPeople(written, {
    "{subject}": heard ? calledBy(content, heard.subject) : "",
  });
}

/** Parts are relative to who is in the room. Left out, that is everyone. */
function partsIn(powerMap: PowerMap, room?: readonly string[]) {
  const present = powerMap.order.filter((id) => room?.includes(id) ?? true);
  return {
    holder: present[0],
    bystander: present[1],
    ignored: present.at(-1),
  };
}

export function matches(
  state: State,
  content: Content,
  condition: Condition | undefined,
  room?: readonly string[],
): boolean {
  if (condition === undefined) return true;
  if ("holderIs" in condition) {
    return condition.holderIs === partsIn(state.truth.powerMap, room).holder;
  }
  if ("bossIs" in condition) {
    return bossKindOf(state, content) === condition.bossIs;
  }
  if ("factNature" in condition) {
    const { character, nature } = condition.factNature;
    const dealt = state.truth.characters.find((c) => c.id === character);
    const fact = content.hiddenTruth.facts.find(
      (f) => f.id === dealt?.fact?.id,
    );
    return fact?.nature === nature;
  }
  if ("heardFact" in condition) {
    return heardAbout(state, condition.heardFact) !== undefined;
  }
  if ("heardTrue" in condition) {
    const heard = heardAbout(state, condition.heardTrue);
    const dealt = state.truth.characters.find((c) => c.id === heard?.subject);
    return dealt?.fact?.id === condition.heardTrue;
  }
  if ("hasBuzzword" in condition) {
    return state.buzzwords.includes(condition.hasBuzzword);
  }
  if ("flag" in condition) return state.flags.includes(condition.flag);
  if ("not" in condition) return !matches(state, content, condition.not, room);
  return condition.all.every((inner) => matches(state, content, inner, room));
}

export function offeredOptions(
  state: State,
  content: Content,
  scene: SceneData,
) {
  return scene.options.filter(
    (o) =>
      (o.about === undefined || heardAbout(state, o.about) !== undefined) &&
      matches(state, content, o.requires),
  );
}

export function sceneData(state: State, world: World, id: string): SceneData {
  const scene = world.content.scenes.find((s) => s.id === id);
  if (!scene) throw new Error(`Unknown Scene "${id}".`);
  const script =
    scene.script === undefined ? undefined : world.sceneScripts[scene.script];
  return script ? script(scene, { powerMap: state.truth.powerMap }) : scene;
}

/** Writes the dealt Characters into text that names parts in the Power Map. */
export function fillParts(
  state: State,
  content: Content,
  written: string,
  room?: readonly string[],
  misleading = false,
): string {
  const who = (id: string | undefined) =>
    id === undefined ? "" : calledBy(content, id);
  const { holder, ignored, bystander } = partsIn(state.truth.powerMap, room);
  return sayPeople(written, {
    "{holder}": who(misleading ? bystander : holder),
    "{ignored}": who(ignored),
    "{bystander}": who(misleading ? holder : bystander),
  });
}

/** An action exists in a month only if the Scene it opens does too. */
export function actionsThisMonth(state: State, content: Content) {
  return content.actions.filter((a) => {
    const scene = content.scenes.find((s) => s.id === a.scene);
    return inMonth(a, state.month) && (!scene || inMonth(scene, state.month));
  });
}

export function isAvailable(
  state: State,
  content: Content,
  action: Content["actions"][number],
): boolean {
  return (
    !isDone(state, action) &&
    costOf(content, action.cost) <= remaining(state, content)
  );
}

export function isDone(
  state: State,
  action: Content["actions"][number],
): boolean {
  return action.oncePerMonth && state.visited.includes(action.id);
}

export function remaining(state: State, content: Content): number {
  return content.balance.actionsPerMonth - state.spent;
}

export function costOf(content: Content, key: string | undefined): number {
  return key === undefined ? 0 : (content.balance.actionCosts[key] ?? 0);
}
