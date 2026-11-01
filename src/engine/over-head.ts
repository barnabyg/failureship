import type { Content } from "./content";
import { isInfluential } from "./deal";
import { applyOutcome } from "./outcome";
import { bossKindOf, inTurn, moodAt } from "./reads";
import { drawFor, pickWeighted } from "./rng";
import type { State, Step } from "./state";

/** A gamble on who the boss's boss really is, and on the boss not hearing of it. */
export function goOverHead(
  state: State,
  content: Content,
  label: string,
): Step {
  const written = content.overHead;
  if (!written) throw new Error("Nothing is written for going over the head.");
  state.overHeadUses += 1;
  const dealt = state.truth.characters.find((c) => c.id === written.character);
  if (!dealt) throw new Error("The boss's boss was not dealt.");
  const standing = isInfluential(state.truth.powerMap, content, dealt.id)
    ? "influential"
    : "sidelined";
  const outcome = written.outcomes[dealt.kind];
  const worked =
    drawFor(state.seed, "over-head-works", state.month) <
    outcome.works[standing];
  const { effects } = written;
  const gained = worked ? effects.worked.boss[standing] : effects.failed.boss;
  const bossKind = bossKindOf(state, content);
  const { findsOut } = written;
  const caught =
    drawFor(state.seed, "over-head-found", state.month) <
    findsOut.chance[bossKind] + findsOut.perUse * (state.overHeadUses - 1);
  applyOutcome(
    state,
    content,
    {
      sets: [written.sets.went],
      headOpinion: worked ? effects.worked.head : effects.failed.head,
      // A boss who has found out is not helped along by being told to listen to you.
      opinion: caught ? 0 : gained,
    },
    label,
  );
  if (caught) {
    applyOutcome(
      state,
      content,
      { sets: [written.sets.caught], opinion: findsOut.shift },
      findsOut.title,
    );
    state.noticesDue.push({
      title: findsOut.title,
      body:
        inTurn(findsOut.reaction[bossKind], state.overHeadUses) ??
        findsOut.title,
    });
  }
  const lines = worked ? outcome.worked[standing] : outcome.failed;
  return {
    kind: "notice",
    title: label,
    body: inTurn(lines, state.overHeadUses) ?? label,
  };
}

/**
 * If the boss's boss is present, one sign of how they treat the player. It has a
 * draw of its own, so that it leaves everything else in the Scene alone.
 */
export function treatHead(
  state: State,
  content: Content,
  cast: readonly string[],
): string | null {
  const written = content.overHead;
  if (!written || !cast.includes(written.character)) return null;
  const mood = moodAt(state.truth.headOpinion, written.opinion);
  const value = drawFor(state.seed, "head-sign", state.month);
  const chosen = pickWeighted(
    Math.floor(value * 2 ** 32),
    written.signs,
    (s) => s.likelihood[mood],
  );
  return chosen.item.id;
}
