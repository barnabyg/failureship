import type {
  Condition,
  Content,
  Kind,
  Mood,
  SceneData,
  SeatWay,
} from "./content";
import { YOU, type PowerMap } from "./deal";
import { isOn, isOnFloor } from "./floors";
import { isPlanRunning, planWords } from "./grand-plans";
import { bossOf, isGone, managerOf, placeOf, whoIs } from "./places";
import { calledBy, capitalised, sayFrom, sayPeople, titleOf } from "./say";
import type { State } from "./state";
import type { Person } from "./view";

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
  return kindOf(state, bossOf(state, content));
}

/** The kind someone was dealt, or has since become. */
export function kindOf(state: State, character: string): Kind {
  const dealt = state.truth.characters.find((c) => c.id === character);
  if (!dealt) throw new Error(`"${character}" was not dealt.`);
  return dealt.kind;
}

export function beliefOf(state: State, character: string): number {
  return state.truth.beliefs[character] ?? 0;
}

export function shiftBelief(
  state: State,
  character: string,
  shift: number,
): void {
  state.truth.beliefs[character] = beliefOf(state, character) + shift;
}

export function moodOf(state: State, content: Content): Mood {
  return moodAt(beliefOf(state, bossOf(state, content)), content.balance.mood);
}

/**
 * How someone's belief stands. Whoever is in each place above the player has
 * that place's point at which it shows.
 */
export function moodOfCharacter(
  state: State,
  content: Content,
  character: string,
): Mood {
  const place = placeOf(state, content, character);
  if (place === "boss") return moodOf(state, content);
  const scale =
    place === "head" && content.overHead
      ? content.overHead.mood
      : (content.reputation?.mood ?? content.balance.mood);
  return moodAt(beliefOf(state, character), scale);
}

export function moodAt(
  belief: number,
  { warmAt, coldAt }: { warmAt: number; coldAt: number },
): Mood {
  if (belief >= warmAt) return "warm";
  return belief <= coldAt ? "cold" : "neutral";
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
    "{subject}": heard ? calledBy(state, content, heard.subject) : "",
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
  const who = (written: string) => whoIs(state, content, written);
  if ("holderIs" in condition) {
    return (
      who(condition.holderIs) === partsIn(state.truth.powerMap, room).holder
    );
  }
  if ("bossIs" in condition) {
    return bossKindOf(state, content) === condition.bossIs;
  }
  if ("factNature" in condition) {
    const { character, nature } = condition.factNature;
    const dealt = state.truth.characters.find((c) => c.id === who(character));
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
  if ("heardOf" in condition) {
    const { fact, character } = condition.heardOf;
    return heardAbout(state, fact)?.subject === who(character);
  }
  if ("hasBuzzword" in condition) {
    return state.buzzwords.includes(condition.hasBuzzword);
  }
  if ("flag" in condition) return state.flags.includes(condition.flag);
  if ("believes" in condition) {
    const { character, mood } = condition.believes;
    return moodOfCharacter(state, content, who(character)) === mood;
  }
  if ("remembers" in condition) {
    const { character, about } = condition.remembers;
    return state.truth.memories.some(
      (m) => m.character === who(character) && m.about === about,
    );
  }
  if ("youOwe" in condition) {
    return state.truth.powerMap.favours.some(
      (f) => f.owes === YOU && f.to === who(condition.youOwe),
    );
  }
  if ("did" in condition) {
    return state.deeds.some((deed) => deed.flag === condition.did);
  }
  if ("sawMove" in condition) {
    return state.movesLanded.includes(condition.sawMove);
  }
  if ("planRunning" in condition) {
    return isPlanRunning(state, content, condition.planRunning);
  }
  if ("vacancyOpen" in condition) {
    const { vacancyOpen } = condition;
    return isVacancyOpen(state, vacancyOpen === true ? undefined : vacancyOpen);
  }
  if ("not" in condition) return !matches(state, content, condition.not, room);
  if ("any" in condition) {
    return condition.any.some((inner) => matches(state, content, inner, room));
  }
  return condition.all.every((inner) => matches(state, content, inner, room));
}

/**
 * Whether the player has come across someone: anyone of the first floor's cast,
 * anyone written for a floor the player has reached, and whoever is above them.
 * Until then a later floor's cast is on no chart, list or results screen of theirs.
 */
export function isMet(state: State, content: Content, id: string): boolean {
  const floor = content.characters.find((c) => c.id === id)?.floor;
  // Whoever is above the player has been met, wherever they were written.
  return (
    floor === undefined ||
    floor === content.you.job ||
    (state.monthsOnFloor[floor] ?? 0) > 0 ||
    placeOf(state, content, id) !== undefined
  );
}

/** Whether a seat has fallen vacant and is still to be decided, open yet or not. */
export function seatPending(state: State): boolean {
  return state.vacancies.some((v) => v.decided === null);
}

/**
 * Whether a seat is open now, and still to be decided, in this way if one is
 * given. The player is told when one is.
 */
export function isVacancyOpen(state: State, way?: SeatWay): boolean {
  return state.vacancies.some(
    (v) =>
      v.decided === null &&
      v.opened <= state.month &&
      (way === undefined || v.way === way),
  );
}

/** The Characters who answer to someone on the Org Chart now, in the order written. */
export function teamOf(state: State, content: Content, id: string): string[] {
  return content.characters
    .map((c) => c.id)
    .filter((c) => !isGone(state, c) && managerOf(state, content, c) === id);
}

/** Someone's job title now, and what text calls them by it: one taken by moving up, or as written. */
export function titleHeld(
  state: State,
  content: Content,
  id: string,
): { title: string; called: string } {
  const written = content.characters.find((c) => c.id === id);
  return (
    state.titles[id] ?? {
      title: written?.title ?? "",
      called: written?.called ?? written?.name ?? id,
    }
  );
}

/** Whether text names someone who has left, by name or by what text calls them. */
export function mentionsGone(
  state: State,
  content: Content,
  written: string,
): boolean {
  const lower = sayFrom(state, content, written).toLowerCase();
  return content.characters.some(
    (c) =>
      isGone(state, c.id) &&
      [c.name, c.called ?? c.name].some((n) => lower.includes(n.toLowerCase())),
  );
}

/** Writes whoever covers for someone who left in place of them, in any text shown. */
export function coverForGone<T>(state: State, content: Content, shown: T): T {
  const gone = content.characters.filter((c) => isGone(state, c.id));
  if (gone.length === 0) return shown;
  const cover = (written: string) =>
    gone.reduce((text, c) => {
      const by = content.changing?.leaving[c.id]?.cover ?? c.name;
      return [c.name, c.called ?? c.name].reduce(
        (t, n) =>
          t.replace(
            new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
            (found) =>
              found[0] === found[0]?.toUpperCase() ? capitalised(by) : by,
          ),
        text,
      );
    }, written);
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return cover(value);
    if (Array.isArray(value)) return value.map(walk);
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, inner]) => [key, walk(inner)]),
      );
    }
    return value;
  };
  return walk(shown) as T;
}

/**
 * The player's word on something, or a Deal, is offered once in a run, nothing
 * is offered that names someone who has left, and an option that requires
 * something is offered only while it holds.
 */
export function optionsOnOffer<
  T extends {
    label: string;
    promise?: string | undefined;
    deal?: string | undefined;
    requires?: Condition | undefined;
  },
>(state: State, content: Content, options: readonly T[]): T[] {
  return options.filter(
    (o) =>
      !state.promises.some((made) => made.id === o.promise) &&
      !state.deals.some((made) => made.id === o.deal) &&
      !mentionsGone(state, content, o.label) &&
      matches(state, content, o.requires),
  );
}

/** The player has heard this of someone who is still here. */
function isHeardOfSomeoneHere(state: State, fact: string): boolean {
  const heard = heardAbout(state, fact);
  return heard !== undefined && !isGone(state, heard.subject);
}

export function offeredOptions(
  state: State,
  content: Content,
  scene: SceneData,
) {
  return optionsOnOffer(state, content, scene.options).filter(
    (o) => o.about === undefined || isHeardOfSomeoneHere(state, o.about),
  );
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
    id === undefined ? "" : calledBy(state, content, id);
  const { holder, ignored, bystander } = partsIn(state.truth.powerMap, room);
  return sayPeople(written, {
    "{holder}": who(misleading ? bystander : holder),
    "{ignored}": who(ignored),
    "{bystander}": who(misleading ? holder : bystander),
    ...planWords(state, content),
  });
}

/** An action exists in a month only if the Scene it opens does too. */
export function actionsThisMonth(state: State, content: Content) {
  return content.actions.filter((a) => {
    const scene = content.scenes.find((s) => s.id === a.scene);
    const method = content.sources.methods.find((m) => m.id === a.findOut);
    const nobodyThere =
      method !== undefined && sourcesHere(state, method.sources).length === 0;
    return (
      isOnFloor(state, content, a.place) &&
      isOn(state, content, a) &&
      (!scene || isOn(state, content, scene)) &&
      !nobodyThere &&
      !mentionsGone(state, content, `${a.label} ${a.description}`)
    );
  });
}

/** Who of these can still be asked. */
export function sourcesHere(state: State, sources: readonly string[]) {
  return sources.filter((s) => !isGone(state, s));
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

export function personOf(state: State, content: Content, id: string): Person {
  const known = content.characters.find((c) => c.id === id);
  return { id, name: known?.name ?? id, title: titleOf(state, content, id) };
}
