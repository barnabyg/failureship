import { dueIdOf, type Content } from "./content";
import { moodOfCharacter, shiftBelief } from "./reads";
import { remember, startNews, tiedTo } from "./reputation";
import { drawFor } from "./rng";
import { calledBy, sayPeople } from "./say";
import type { State } from "./state";
import { monthAfter } from "./threads";

type Written = NonNullable<Content["promises"]>;

function writtenPromises(content: Content): Written {
  if (!content.promises) throw new Error("No Promises are written.");
  return content.promises;
}

/** What has reached someone about the player's word, most recent last. */
function wordsThatReached(state: State, written: Written, character: string) {
  const reached = (about: string) =>
    state.truth.memories.filter(
      (m) => m.character === character && m.about === about,
    );
  return {
    broken: reached(written.broken.about),
    kept: reached(written.kept.about),
  };
}

/** Who they are, what they make of the player and what they have seen and heard. */
function believes(
  state: State,
  content: Content,
  written: Written,
  id: string,
  character: string,
): boolean {
  const dealt = state.truth.characters.find((c) => c.id === character);
  if (!dealt) return false;
  const { chance, mood, perBroken, perKept } = written.belief;
  const { broken, kept } = wordsThatReached(state, written, character);
  const odds =
    chance[dealt.kind] +
    mood[moodOfCharacter(state, content, character)] -
    perBroken * broken.length +
    perKept * kept.length;
  return drawFor(state.seed, `promise:${id}`, state.month) < odds;
}

/** What they say back, in which the reason for it shows. */
function replyOf(
  state: State,
  content: Content,
  written: Written,
  item: Written["items"][number],
  believed: boolean,
): string {
  const dealt = state.truth.characters.find((c) => c.id === item.to);
  if (!dealt) return "";
  const { replies } = written;
  const last = wordsThatReached(state, written, item.to).broken.at(-1);
  const word = state.truth.news[last?.news ?? -1]?.word;
  const lines = believed
    ? replies.believed[dealt.kind]
    : word
      ? word.victim === item.to
        ? replies.letDown
        : replies.heard
      : replies.doubted[dealt.kind];
  const value = drawFor(state.seed, `promise-reply:${item.id}`, state.month);
  const line = lines[Math.floor(value * lines.length)] ?? "";
  return sayPeople(line, {
    "{who}": calledBy(content, item.to),
    "{what}": word && !believed ? word.what : item.what,
    "{victim}": word ? calledBy(content, word.victim) : "",
  });
}

/**
 * The player offers something, whether or not they can deliver it. Being believed
 * is what they get for it. A refused Promise is remembered, and never falls due.
 */
export function makePromise(state: State, content: Content, id: string): void {
  const written = writtenPromises(content);
  const item = written.items.find((p) => p.id === id);
  if (!item) throw new Error(`Unknown Promise "${id}".`);
  const believed = believes(state, content, written, id, item.to);
  const reply = replyOf(state, content, written, item, believed);
  state.promises.push({
    id,
    month: state.month,
    status: believed ? "open" : "refused",
    due: believed ? monthAfter(state, `promise-wait:${id}`, item.after) : null,
    reply,
    news: null,
  });
  remember(state, content, {
    character: item.to,
    about: believed ? "believed-a-promise" : "refused-a-promise",
    text: item.title,
    tone: believed ? "good" : undefined,
  });
}

/** The words a choice shows for a Promise it has just made. */
export function replyToPromise(
  state: State,
  content: Content,
  id: string | undefined,
): { title: string; body: string } | null {
  const made = state.promises.find((p) => p.id === id);
  const item = content.promises?.items.find((p) => p.id === id);
  return made && item ? { title: item.title, body: made.reply } : null;
}

/** As a month opens, whatever the player promised for now arrives to be answered. */
export function promisesFallDue(state: State): void {
  for (const made of state.promises) {
    if (made.status === "open" && made.due === state.month) {
      state.unanswered.unshift(dueIdOf(made.id));
    }
  }
}

/**
 * The victim knows, and so does everyone tied to them, straight away, so the
 * better connected they are the further it goes and the harder it lands.
 */
export function breakWord(
  state: State,
  content: Content,
  word: { victim: string; what: string },
): number {
  const { broken } = writtenPromises(content);
  const ties = tiedTo(state, word.victim);
  const news = startNews(state, content, {
    about: broken.about,
    tone: "bad",
    text: sayPeople(broken.text, {
      "{victim}": calledBy(content, word.victim),
      "{what}": word.what,
    }),
    at: [word.victim, ...ties],
    word,
  });
  shiftBelief(state, word.victim, -broken.perTie * ties.length);
  return news;
}

/** Good news travels too, though only at its own pace. */
export function keepWord(
  state: State,
  content: Content,
  word: { victim: string; what: string },
): number {
  const { kept } = writtenPromises(content);
  return startNews(state, content, {
    about: kept.about,
    tone: "good",
    text: sayPeople(kept.text, {
      "{victim}": calledBy(content, word.victim),
      "{what}": word.what,
    }),
    at: [word.victim],
  });
}

/** An answer to what fell due either keeps the player's word or breaks it. */
export function settlePromise(
  state: State,
  content: Content,
  notificationId: string,
  how: "kept" | "broken",
): void {
  const made = state.promises.find((p) => dueIdOf(p.id) === notificationId);
  const item = content.promises?.items.find((p) => p.id === made?.id);
  if (!made || !item) return;
  const word = { victim: item.to, what: item.what };
  made.status = how;
  made.news =
    how === "kept"
      ? keepWord(state, content, word)
      : breakWord(state, content, word);
}

/** Each Promise made, with what is written of it. */
function promisesMade(state: State, content: Content) {
  const written = content.promises;
  return state.promises.flatMap((made) => {
    const item = written?.items.find((p) => p.id === made.id);
    if (!written || !item) return [];
    const row = {
      month: made.month,
      to: calledBy(content, item.to),
      what: item.what,
      status: written.statuses[made.status],
    };
    return [{ made, item, row }];
  });
}

export function promisesInView(state: State, content: Content) {
  return promisesMade(state, content).map(({ row }) => row);
}

/** Everything the list said, and who else it reached, which only now can be told. */
export function promisesInResults(state: State, content: Content) {
  return promisesMade(state, content).map(({ made, item, row }) => {
    const heardBy = state.truth.memories
      .filter(
        (m) =>
          made.news !== null && m.news === made.news && m.character !== item.to,
      )
      .map((m) => calledBy(content, m.character));
    return { ...row, heardBy };
  });
}
