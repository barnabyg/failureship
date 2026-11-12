import { everyBill, type Bill, type Content, type Escape } from "./content";
import { gaugeFromEscape, gaugeNeeded, gaugesFromThread } from "./gauges";
import { applyOutcome } from "./outcome";
import { isGone, whoIs } from "./places";
import {
  bossKindOf,
  isMet,
  matches,
  moodOfCharacter,
  shiftBelief,
} from "./reads";
import { remember, startNews } from "./reputation";
import { rivalsNow } from "./rivals";
import { drawFor } from "./rng";
import { calledBy, sayPeople } from "./say";
import type { GaugeMove, Result, State, Step } from "./state";

/**
 * A consequence of the player's own bad behaviour waits for them to choose a
 * way out, instead of landing at once. Returns whether it waits.
 */
export function holdForEscape(
  state: State,
  bill: Bill,
  gauges: readonly GaugeMove[],
): boolean {
  if (bill.escapes.length === 0) return false;
  state.escapesDue.push({ bill: bill.id, gauges: [...gauges] });
  return true;
}

/**
 * Whether a consequence waits in the inbox, to be escaped any time before the
 * month closes. One that comes as a Character Move waits for where Moves land,
 * as `landBill` says, and asks there.
 */
export function inInbox(content: Content, id: string): boolean {
  return billOf(content, id).as !== "move";
}

/** The consequences to escape from in the inbox, in the order they came. */
export function inboxEscapes(state: State, content: Content): string[] {
  return state.escapesDue
    .map((d) => d.bill)
    .filter((id) => inInbox(content, id));
}

/** The first consequence to escape from in the inbox, if any. */
export function nextEscape(state: State, content: Content): Step | null {
  const [id] = inboxEscapes(state, content);
  return id === undefined ? null : { kind: "escape", id };
}

function billOf(content: Content, id: string): Bill {
  const bill = everyBill(content).find((b) => b.id === id);
  if (!bill) throw new Error(`Unknown Bill "${id}".`);
  return bill;
}

/** Whom an Escape names, if it names anyone who can be named now. */
function blamedBy(
  state: State,
  content: Content,
  escape: Escape,
): string | undefined {
  if (escape.kind !== "blame") return undefined;
  try {
    const id = whoIs(state, content, escape.blames);
    return isGone(state, id) || !isMet(state, content, id) ? undefined : id;
  } catch {
    // Nobody is in the place written.
    return undefined;
  }
}

/** What an Escape needs before it can be played, if the player is short of it. */
function needs(state: State, content: Content, escape: Escape) {
  return escape.kind === "take"
    ? undefined
    : gaugeNeeded(state, content, escape.minTeflon);
}

/**
 * The Escapes in view: nobody is blamed who has gone, or whom the player never
 * met. One that needs more Teflon than the player has is shown with what it needs.
 */
export function escapesInView(state: State, content: Content, id: string) {
  return billOf(content, id)
    .escapes.filter(
      (e) => e.kind !== "blame" || blamedBy(state, content, e) !== undefined,
    )
    .map((escape) => ({ escape, needs: needs(state, content, escape) }));
}

/** The Escapes the player can choose: those in view that need nothing more. */
export function escapesOnOffer(
  state: State,
  content: Content,
  id: string,
): Escape[] {
  return escapesInView(state, content, id).flatMap((e) =>
    e.needs === undefined ? [e.escape] : [],
  );
}

/** The consequence as written, as it lands when taken or when an Escape fails. */
function land(
  state: State,
  content: Content,
  bill: Bill,
  gauges: readonly GaugeMove[],
): void {
  gaugesFromThread(state, gauges);
  applyOutcome(state, content, bill, bill.title);
  if (bill.as === "notification") state.unanswered.unshift(bill.id);
}

/**
 * Why an Escape fails, or null if it works. What the player could have read
 * decides it: whom they named, and their boss's kind. Only an explicit bet in
 * the content is left to the seed.
 */
function whyItFails(
  state: State,
  content: Content,
  escape: Exclude<Escape, { kind: "take" }>,
): string | null {
  const rules = content.escapes;
  const blamed = blamedBy(state, content, escape);
  if (blamed !== undefined) {
    const fact = state.truth.characters.find((c) => c.id === blamed)?.fact;
    const nature = content.hiddenTruth.facts.find(
      (f) => f.id === fact?.id,
    )?.nature;
    if (fact && nature === "dangerous") {
      return sayPeople(rules?.why.dangerous ?? "", {
        "{name}": calledBy(state, content, blamed),
        "{fact}": fact.text,
      });
    }
  }
  if (
    escape.kind === "lie" &&
    bossKindOf(state, content) === "believer" &&
    matches(state, content, escape.seen)
  ) {
    return rules?.why.lie ?? "";
  }
  if (escape.fails && matches(state, content, escape.fails)) {
    return escape.failed.why ?? "";
  }
  if (
    escape.chance !== undefined &&
    drawFor(state.seed, `escape:${escape.id}`, state.month) >= escape.chance
  ) {
    return rules?.why.bet ?? "";
  }
  return null;
}

/**
 * Whoever the player names keeps it, whether or not it works. Blaming someone
 * who was warm to them turns them further, and a Rival makes sure it gets round.
 */
function name(
  state: State,
  content: Content,
  blamed: string,
  bill: Bill,
): string[] {
  const rules = content.escapes;
  if (!rules) return [];
  const notes: string[] = [];
  const who = { "{name}": calledBy(state, content, blamed) };
  const kept = {
    about: rules.blamed.about,
    text: sayPeople(rules.blamed.text, { "{what}": bill.title }),
    tone: "bad" as const,
  };
  if (moodOfCharacter(state, content, blamed) === "warm") {
    shiftBelief(state, blamed, rules.blamed.warm);
    notes.push(sayPeople(rules.why.warm, who));
  }
  if (rivalsNow(state, content).some((r) => r.character === blamed)) {
    startNews(state, content, { ...kept, at: [blamed], victim: blamed });
    notes.push(sayPeople(rules.why.rival, who));
  } else {
    remember(state, content, { ...kept, character: blamed });
  }
  return notes;
}

/** The player chooses a way out of a consequence. Returns what they are told. */
export function chooseEscape(
  state: State,
  content: Content,
  billId: string,
  escapeId: string,
): Result | null {
  const bill = billOf(content, billId);
  const escape = bill.escapes.find((e) => e.id === escapeId);
  const at = state.escapesDue.findIndex((d) => d.bill === billId);
  const due = state.escapesDue[at];
  if (!escape || !due) throw new Error(`Unknown Escape "${escapeId}".`);
  state.escapesDue.splice(at, 1);
  const told = (body: string): Result => ({
    kind: "happened",
    title: bill.title,
    body,
  });
  if (escape.kind === "take") {
    land(state, content, bill, due.gauges);
    return escape.body === undefined ? null : told(escape.body);
  }
  const failure = whyItFails(state, content, escape);
  const blamed = blamedBy(state, content, escape);
  const notes = blamed === undefined ? [] : name(state, content, blamed, bill);
  const record = {
    month: state.month,
    bill: bill.id,
    escape: escape.id,
  };
  if (failure === null) {
    const { worked } = escape;
    applyOutcome(state, content, worked, escape.label);
    gaugeFromEscape(state, content, true, worked.reported);
    state.escapes.push({
      ...record,
      worked: true,
      why: [worked.happened, ...notes],
    });
    return told(worked.body);
  }
  land(state, content, bill, due.gauges);
  applyOutcome(state, content, escape.failed, escape.label);
  const note = sayPeople(content.escapes?.failed.note ?? "", {
    "{what}": bill.title,
  });
  gaugeFromEscape(state, content, false, note);
  state.escapes.push({ ...record, worked: false, why: [failure, ...notes] });
  return told(escape.failed.body);
}

/** The official story of the month's Escapes that worked: reported, beside what happened. */
export function escapesInStory(state: State, content: Content) {
  return state.escapes.flatMap((e) => {
    const escape = billOf(content, e.bill).escapes.find(
      (x) => x.id === e.escape,
    );
    return e.month === state.month && e.worked && escape?.kind !== "take"
      ? [
          {
            reported: escape?.worked.reported,
            happened: escape?.worked.happened,
          },
        ]
      : [];
  });
}

/** Each Escape tried, for the results screen: whether it worked, and why. */
export function escapesInResults(state: State, content: Content) {
  const rules = content.escapes;
  return state.escapes.flatMap((e) => {
    const bill = billOf(content, e.bill);
    const escape = bill.escapes.find((x) => x.id === e.escape);
    if (!escape || !rules) return [];
    return [
      {
        month: e.month,
        title: bill.title,
        label: escape.label,
        kind: rules.kinds[escape.kind],
        worked: e.worked,
        why: e.why,
      },
    ];
  });
}
