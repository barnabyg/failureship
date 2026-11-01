import type { Content, Kind } from "./content";
import { bossKindOf, inTurn, moodOf, shiftBelief } from "./reads";
import { remember } from "./reputation";
import { pickWeighted } from "./rng";
import type { State, World } from "./state";

/**
 * Moves the boss's opinion by what the choice says, and by how this kind of
 * boss takes its approach. Returns the sign of that, if it has one.
 */
export function landWithBoss(
  state: State,
  content: Content,
  choice: {
    opinion?: number;
    approach?: string | undefined;
    reaction?: Readonly<Record<Kind, string>> | undefined;
  },
  label: string,
): string | undefined {
  const kind = bossKindOf(state, content);
  const approach = content.boss.approaches.find(
    (a) => a.id === choice.approach,
  );
  const uses = approach ? (state.approachUses[approach.id] ?? 0) + 1 : 0;
  if (approach) state.approachUses[approach.id] = uses;
  const overdone =
    approach?.overdone && uses > approach.overdone.after
      ? approach.overdone
      : undefined;
  const shift =
    (choice.opinion ?? 0) +
    (overdone?.shift[kind] ?? approach?.shift[kind] ?? 0);
  shiftBelief(state, content.boss.character, shift);
  if (approach === undefined && shift === 0) return undefined;
  state.bossLandings.push({ month: state.month, choice: label, shift });
  if (shift !== 0) {
    remember(state, content, {
      character: content.boss.character,
      about: "impression",
      text: label,
    });
  }
  if (approach === undefined) return undefined;
  const lines = overdone?.reaction[kind];
  if (lines) return inTurn(lines, state.month);
  const usual = approach.reaction[kind];
  return choice.reaction?.[kind] ?? inTurn(usual, state.month);
}

/** If the boss is present, one sign of how they treat the player. */
export function treatBoss(
  state: State,
  { content }: World,
  cast: readonly string[],
): string | null {
  const { character, signs } = content.boss;
  if (signs.length === 0 || !cast.includes(character)) return null;
  const mood = moodOf(state, content);
  const chosen = pickWeighted(state.rng, signs, (s) => s.likelihood[mood]);
  state.rng = chosen.next;
  return chosen.item.id;
}
