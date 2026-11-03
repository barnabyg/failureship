import type { PlayerView, Run } from "../../src/engine";
import type { PowerMap } from "../../src/engine/hidden-truth";
import { sceneFixtureRaw } from "./fixture";

export const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

const family = (label: string) => ({ label, note: "NOTE" });

/** Ana is the boss, and the boss and Ben compete for the credit. Cal never does. */
export function rivalsRaw() {
  return {
    ...sceneFixtureRaw(),
    rivals: {
      competing: [
        { id: "credit", for: "FOR-CREDIT", who: ["{boss}", "ben"] },
      ] as { id: string; for: string; who: string[]; when?: unknown }[],
      most: 2,
      dealAgain: 0,
      moveChance: 0.5,
      makers: { believer: 1, incompetent: 2, practitioner: 6 },
      didNothing: "DID-NOTHING",
    },
    families: {
      impress: family("IMPRESS"),
      fabricate: family("FABRICATE"),
      trade: family("TRADE"),
      "find-out": family("FIND-OUT"),
      deflect: family("DEFLECT"),
      attack: family("ATTACK"),
      deliver: family("DELIVER"),
    },
  };
}

/** Someone competing claims the credit whenever they can, and others do other things. */
export function competitorMovesRaw() {
  const raw = rivalsRaw();
  raw.rivals.moveChance = 1;
  raw.moves = [
    {
      id: "claimed",
      by: "{competitor}",
      family: "deflect",
      from: "Overheard",
      title: "MOVE-CLAIMED",
      body: "{competitor} CLAIMED your work.",
      sets: ["credit-claimed"],
    },
    ...plainMoves(),
  ];
  return raw;
}

/** Enough Moves that nobody else's lands twice in a short run. */
export function plainMoves() {
  return [1, 2, 3].map((n) => ({
    id: `plain-${String(n)}`,
    from: "Facilities",
    title: `MOVE-PLAIN-${String(n)}`,
    body: "Plain.",
  }));
}

const sign = (id: string, warm: number, neutral: number, cold: number) => ({
  id,
  text: `{who} SIGN-${id}`,
  likelihood: { warm, neutral, cold },
});

/**
 * Six people, a competitor's false story in the first month, and news that goes
 * one tie a month, as far as `maxHops`, and that Believers see through at the
 * chance given.
 */
export function storyRaw(maxHops: number, foundOut = 0) {
  const raw = competitorMovesRaw();
  raw.balance.monthsPerRun = 4;
  raw.hiddenTruth.charactersWithFact = 4;
  raw.hiddenTruth.facts.push({
    id: "fact-d",
    text: "SECRET-DELTA about {name}",
  });
  raw.characters.push(
    { id: "dan", name: "Dan Dee", title: "Clerk", reportsTo: "ana" },
    { id: "eve", name: "Eve Ely", title: "Clerk", reportsTo: "ana" },
    { id: "fay", name: "Fay Fox", title: "Clerk", reportsTo: "ana" },
  );
  raw.moves = [
    {
      id: "rumour",
      by: "{competitor}",
      family: "attack",
      from: "Overheard",
      title: "MOVE-RUMOUR",
      body: "Your project is in trouble, apparently.",
      falseStory: { about: "in-trouble", text: "STORY-IN-TROUBLE" },
    },
    ...plainMoves(),
  ];
  return {
    ...raw,
    reputation: {
      travel: {
        hopsPerMonth: 1,
        maxHops,
        passOnChance: 1,
        shift: { good: 1, bad: -1 },
      },
      mood: { warmAt: 1, coldAt: -1 },
      signs: [sign("warm", 9, 1, 0), sign("cold", 0, 1, 9)],
      believes: {
        warm: "THINKS-WELL",
        neutral: "NO-VIEW",
        cold: "THINKS-BADLY",
      },
      how: { direct: "WAS-THERE", heardFrom: "HEARD-FROM {who}" },
      falseStories: {
        foundOut: { believer: foundOut, incompetent: 0, practitioner: 0 },
        started: "STARTED-IT",
        found: "FOUND-OUT-IN {month}",
      },
    },
  };
}

/** Plays on with the first choice each time, keeping every view. */
export function playOut(run: Run): PlayerView[] {
  const views = [run.view()];
  for (;;) {
    const next = views.at(-1)?.choices[0];
    if (!next) return views;
    views.push(run.choose(next));
  }
}

export function resultsOf(views: readonly PlayerView[]) {
  const step = views.at(-1)?.step;
  if (step?.kind !== "results") throw new Error(step?.kind);
  return step;
}

/** Everyone within so many ties of influence of where something started. */
export function within(map: PowerMap, from: string, hops: number): Set<string> {
  let reached = new Set([from]);
  for (let i = 0; i < hops; i++) {
    const next = new Set(reached);
    for (const { who, over } of map.influence) {
      if (reached.has(who)) next.add(over);
      if (reached.has(over)) next.add(who);
    }
    reached = next;
  }
  return reached;
}
