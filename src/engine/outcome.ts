import { landWithBoss } from "./boss";
import { reshuffleCharts, type Reshuffle } from "./charts";
import type { Content, Kind, MoveFamily, Tone } from "./content";
import { makeDeal, settleDeal } from "./deals";
import { YOU } from "./deal";
import { completePlans } from "./grand-plans";
import { makeMistake } from "./mistakes";
import { headOf, whoIs } from "./places";
import { moveProject, type ProjectChange } from "./project";
import { makePromise, settlePromise } from "./promises";
import { shiftBelief } from "./reads";
import { remember, startNews, startStory } from "./reputation";
import { startRisks } from "./risks";
import { startThreads } from "./threads";
import { actForSeat } from "./vacancies";
import type { State } from "./state";

/** Everything a consequence can do, whether a choice or something else caused it. */
export interface Outcome {
  sets?: readonly string[];
  opinion?: number;
  headOpinion?: number;
  approach?: string | undefined;
  reaction?: Readonly<Record<Kind, string>> | undefined;
  project?: ProjectChange | undefined;
  mistake?: "big" | "catastrophic" | undefined;
  learns?: readonly string[];
  reshuffle?: Reshuffle | undefined;
  remembers?: readonly {
    character: string;
    about: string;
    text: string;
    tone?: Tone | undefined;
  }[];
  news?:
    | { about: string; tone: Tone; text: string; at: readonly string[] }
    | undefined;
  falseStory?:
    | {
        about: string;
        text: string;
        of?: string | undefined;
        at?: readonly string[] | undefined;
        exposed?: { about: string; text: string } | undefined;
      }
    | undefined;
  promise?: string | undefined;
  deal?: string | undefined;
  /** Pays back the favour the player owes this Character. */
  repays?: string | undefined;
  /** Keeps or breaks the commitment that fell due as this Notification. */
  settlesDue?: { id: string; how: "kept" | "broken" } | undefined;
  /** What whoever acts does for an open seat. */
  seat?: Parameters<typeof actForSeat>[2] | undefined;
}

/** Counts a Move the player made, for how they played. */
export function countMove(state: State, family: MoveFamily | undefined): void {
  if (family) state.played[family] = (state.played[family] ?? 0) + 1;
}

/**
 * The one place a consequence takes effect, whatever caused it. Returns the sign
 * of how the boss took it, if it has one.
 */
export function applyOutcome(
  state: State,
  content: Content,
  outcome: Outcome,
  label: string,
  /** Who acts: the player, unless a Character's Move does. */
  actor: string = YOU,
): string | undefined {
  const sets = outcome.sets ?? [];
  state.flags.push(...sets);
  state.deeds.push(...sets.map((flag) => ({ flag, month: state.month })));
  startThreads(state, content, sets);
  startRisks(state, content, sets);
  completePlans(state, content);
  const who = (written: string) => whoIs(state, content, written);
  for (const memory of outcome.remembers ?? []) {
    remember(state, content, { ...memory, character: who(memory.character) });
  }
  if (outcome.news) {
    startNews(state, content, {
      ...outcome.news,
      at: outcome.news.at.map(who),
    });
  }
  // A Move's story is started where it lands, by whoever made it.
  const told = outcome.falseStory;
  if (told?.of !== undefined) {
    startStory(state, content, {
      ...told,
      of: who(told.of),
      at: told.at?.map(who),
      by: YOU,
    });
  }
  if (outcome.promise !== undefined) {
    makePromise(state, content, outcome.promise);
  }
  if (outcome.deal !== undefined) makeDeal(state, content, outcome.deal);
  if (outcome.repays !== undefined) {
    const owed = who(outcome.repays);
    const map = state.truth.powerMap;
    map.favours = map.favours.filter((f) => !(f.owes === YOU && f.to === owed));
  }
  if (outcome.settlesDue) {
    const { id, how } = outcome.settlesDue;
    settlePromise(state, content, id, how);
    settleDeal(state, content, id, how);
  }
  for (const word of outcome.learns ?? []) {
    if (!state.buzzwords.includes(word)) state.buzzwords.push(word);
  }
  if (outcome.reshuffle) reshuffleCharts(state, content, outcome.reshuffle);
  if (outcome.seat) actForSeat(state, content, outcome.seat, actor);
  const head = headOf(state, content);
  if (head !== undefined && outcome.headOpinion) {
    shiftBelief(state, head, outcome.headOpinion);
    remember(state, content, {
      character: head,
      about: "impression",
      text: label,
    });
  }
  moveProject(state, content, outcome.project);
  if (outcome.mistake) makeMistake(state, content, outcome.mistake, label);
  return landWithBoss(state, content, outcome, label);
}
