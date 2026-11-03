import { dueIdOf, type Content } from "./content";
import { hasSway, YOU } from "./deal";
import { bossOf, whoIs } from "./places";
import { breakWord, keepWord } from "./promises";
import { shiftBelief } from "./reads";
import { remember } from "./reputation";
import { drawFor } from "./rng";
import { calledBy, sayPeople } from "./say";
import type { State } from "./state";
import { monthAfter } from "./threads";

type Written = NonNullable<Content["deals"]>;

function writtenDeal(content: Content, id: string | undefined) {
  return content.deals?.items.find((d) => d.id === id);
}

/** Both sides agree. Neither yet knows whether the other can deliver. */
export function makeDeal(state: State, content: Content, id: string): void {
  const item = writtenDeal(content, id);
  if (!item) throw new Error(`Unknown Deal "${id}".`);
  state.deals.push({
    id,
    month: state.month,
    word: "pending",
    wordDue: monthAfter(state, `deal-word:${id}`, item.word.after),
    status: "open",
    due: monthAfter(state, `deal-wait:${id}`, item.after),
    news: null,
  });
}

/** What the other side says as they shake on it. */
export function replyToDeal(
  state: State,
  content: Content,
  id: string | undefined,
): { title: string; body: string } | null {
  const item = writtenDeal(content, id);
  return item
    ? {
        title: item.title,
        body: sayPeople(item.agreed, {
          "{who}": calledBy(state, content, item.with),
        }),
      }
    : null;
}

function owe(state: State, owes: string, to: string, why: string): void {
  state.truth.powerMap.favours.push({ owes, to, why });
}

/**
 * Their side: whether they give the word is seeded by who they are, and whether it
 * is worth anything is whether they really have sway, which nobody tells the player.
 */
function giveTheWord(
  state: State,
  content: Content,
  made: State["deals"][number],
  item: Written["items"][number],
): void {
  const dealt = state.truth.characters.find((c) => c.id === item.with);
  if (!dealt) return;
  const { word } = item;
  const gives =
    drawFor(state.seed, `deal-gives:${item.id}`, state.month) <
    word.chance[dealt.kind];
  if (!gives) {
    made.word = "withheld";
    owe(state, item.with, YOU, item.owed.them);
    state.noticesDue.push(word.withheld);
    return;
  }
  state.noticesDue.push(word.given);
  const over = whoIs(state, content, word.over);
  if (!hasSway(state.truth.powerMap, item.with, over)) {
    made.word = "worthless";
    return;
  }
  made.word = "landed";
  shiftBelief(state, over, word.shift);
  remember(state, content, {
    character: over,
    about: "good-word",
    text: item.worth.landed,
  });
  if (over === bossOf(state, content)) {
    state.bossLandings.push({
      month: state.month,
      boss: over,
      choice: item.title,
      shift: word.shift,
    });
  }
}

/** As a month opens: the other side delivers or not, and the player's side falls due. */
export function dealsFallDue(state: State, content: Content): void {
  for (const made of state.deals) {
    const item = writtenDeal(content, made.id);
    if (!item) continue;
    if (made.word === "pending" && made.wordDue === state.month) {
      giveTheWord(state, content, made, item);
    }
    if (made.status === "open" && made.due === state.month) {
      state.unanswered.unshift(dueIdOf(made.id));
    }
  }
}

/** A Deal the player does not honour behaves like a broken Promise, and is owed. */
export function settleDeal(
  state: State,
  content: Content,
  notificationId: string,
  how: "kept" | "broken",
): void {
  const made = state.deals.find((d) => dueIdOf(d.id) === notificationId);
  const item = writtenDeal(content, made?.id);
  if (!made || !item) return;
  const word = { victim: item.with, what: item.what };
  made.status = how;
  if (how === "kept") {
    made.news = keepWord(state, content, word);
    return;
  }
  made.news = breakWord(state, content, word);
  owe(state, YOU, item.with, item.owed.you);
}

/** Only what the player is party to: their own Deals, and favours to or from them. */
export function dealsInView(state: State, content: Content) {
  const written = content.deals;
  if (!written) return { deals: [], favours: [] };
  const deals = state.deals.flatMap((made) => {
    const item = writtenDeal(content, made.id);
    return item
      ? [
          {
            month: made.month,
            with: calledBy(state, content, item.with),
            what: item.title,
            status: written.statuses[made.status],
          },
        ]
      : [];
  });
  const favours = state.truth.powerMap.favours
    .filter((f) => f.owes === YOU || f.to === YOU)
    .map((f) => favourText(state, content, written, f));
  return { deals, favours };
}

function favourText(
  state: State,
  content: Content,
  written: Written,
  favour: { owes: string; to: string; why: string },
): string {
  const line =
    favour.owes === YOU
      ? written.owed.youOwe
      : favour.to === YOU
        ? written.owed.owesYou
        : written.owed.between;
  return sayPeople(line, {
    "{owes}": calledBy(state, content, favour.owes),
    "{to}": calledBy(state, content, favour.to),
    "{who}": calledBy(
      state,
      content,
      favour.owes === YOU ? favour.to : favour.owes,
    ),
    "{why}": sayPeople(favour.why, {
      "{owes}": calledBy(state, content, favour.owes),
      "{to}": calledBy(state, content, favour.to),
    }),
  });
}

/** What each Deal was really worth, and every favour on the true Power Map. */
export function dealsInResults(state: State, content: Content) {
  const written = content.deals;
  if (!written) return { deals: [], favours: [] };
  const deals = state.deals.flatMap((made) => {
    const item = writtenDeal(content, made.id);
    if (!item) return [];
    const worth = item.worth[made.word];
    return [
      {
        month: made.month,
        with: calledBy(state, content, item.with),
        what: item.title,
        status: written.statuses[made.status],
        worth,
      },
    ];
  });
  const favours = state.truth.powerMap.favours.map((f) =>
    favourText(state, content, written, f),
  );
  return { deals, favours };
}
