import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import {
  parseContent,
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { readHiddenTruth, type PowerMap } from "../../src/engine/hidden-truth";
import { plainChoice } from "../../src/ui/later-month";
import { emptyMonthRaw } from "./fixture";

const SEEDS = Array.from({ length: 200 }, (_, i) => i);
const lines = (written: string) => ({
  believer: [written],
  incompetent: [written],
  practitioner: [written],
});

function raw({ gives = 1, favours = 0 } = {}) {
  const base = emptyMonthRaw();
  return {
    ...base,
    balance: { ...base.balance, monthsPerRun: 4 },
    promises: {
      belief: {
        chance: { believer: 1, incompetent: 1, practitioner: 1 },
        mood: { warm: 0, neutral: 0, cold: 0 },
        perBroken: 0,
        perKept: 0,
      },
      replies: {
        believed: lines("{who} {what}"),
        doubted: lines("{who} {what}"),
        letDown: ["{who} {what}"],
        heard: ["{who} {victim} {what}"],
      },
      broken: { about: "broke", text: "BROKE {victim} {what}", perTie: 1 },
      kept: { about: "kept", text: "KEPT {victim} {what}" },
      statuses: {
        open: "OPEN",
        kept: "KEPT",
        broken: "BROKEN",
        refused: "REFUSED",
        lapsed: "LAPSED",
      },
      items: [],
    },
    deals: {
      favours: {
        dealt: favours,
        why: ["SECRET-FAVOUR-A {owes} {to}", "SECRET-FAVOUR-B {owes} {to}"],
      },
      owed: {
        youOwe: "YOU-OWE {who}: {why}",
        owesYou: "OWES-YOU {who}: {why}",
        between: "BETWEEN {why}",
      },
      statuses: {
        open: "D-OPEN",
        kept: "D-KEPT",
        broken: "D-BROKEN",
        refused: "D-REFUSED",
        lapsed: "D-LAPSED",
      },
      items: [
        {
          id: "word",
          with: "ben",
          title: "WORD-DEAL",
          what: "WHAT-WORD",
          agreed: "{who} AGREES",
          word: {
            over: "ana",
            after: { min: 1, max: 1 },
            chance: {
              believer: gives,
              incompetent: gives,
              practitioner: gives,
            },
            shift: 3,
            given: { title: "GIVEN", body: "The word is given." },
            withheld: { title: "WITHHELD", body: "No word." },
          },
          after: { min: 2, max: 2 },
          due: {
            from: "Ben",
            subject: "DEAL-DUE",
            body: "Your side.",
            options: [
              { id: "do-it", label: "Do it", settles: "kept" },
              { id: "not-do-it", label: "Do not", settles: "broken" },
            ],
          },
          owed: { you: "YOU-LET-BEN-DOWN", them: "BEN-LET-YOU-DOWN" },
          worth: {
            landed: "WORTH-LANDED",
            worthless: "WORTH-NOTHING",
            withheld: "WORTH-WITHHELD",
            pending: "WORTH-PENDING",
          },
        },
      ],
    },
    notifications: [
      {
        id: "offer",
        from: "Ben",
        subject: "A deal",
        body: "Ben wants a deal.",
        months: [1],
        options: [
          { id: "no", label: "No" },
          { id: "shake", label: "Shake on it", deal: "word" },
        ],
      },
    ],
  };
}

const answer = (notificationId: string, optionId: string): Choice => ({
  type: "notification",
  notificationId,
  optionId,
});

/** Plays on until the view holds what is wanted, or the run ends. */
function playOn(run: Run, until: (view: PlayerView) => boolean) {
  let view = run.view();
  while (!until(view)) {
    const next = view.choices[0];
    if (!next) break;
    view = run.choose(next);
  }
  return view;
}

/** Whether someone is above another on the Power Map, or is owed by them. */
function swayOf(map: PowerMap, who: string, over: string): boolean {
  if (map.favours.some((f) => f.owes === over && f.to === who)) return true;
  for (let at = over; ;) {
    const above = map.influence.find((i) => i.over === at)?.who;
    if (above === undefined) return false;
    if (above === who) return true;
    at = above;
  }
}

describe("a Deal", () => {
  it("has each side offer something, and shows the player only their own", () => {
    const run = startRun({ seed: 1, content: parseContent(raw()) });

    const view = run.choose(answer("offer", "shake"));

    expect(view.step).toMatchObject({
      kind: "notice",
      body: "Ben Bird AGREES",
    });
    expect(view.deals).toEqual([
      { month: 1, with: "Ben Bird", what: "WORD-DEAL", status: "D-OPEN" },
    ]);
  });

  it("moves the boss with a good word only if the giver has sway over the boss", () => {
    const content = parseContent(raw());
    const landed = SEEDS.map((seed) => {
      const run = startRun({ seed, content });
      run.choose(answer("offer", "shake"));
      const before = readHiddenTruth(run).bossBelief;
      playOn(run, (v) => v.month === 2);
      const truth = readHiddenTruth(run);
      const moved = truth.bossBelief - before;

      expect(moved).toBe(swayOf(truth.powerMap, "ben", "ana") ? 3 : 0);
      return moved > 0;
    });

    expect(landed).toContain(true);
    expect(landed).toContain(false);
  });

  it("says the same to the player whether the word was worth anything", () => {
    const content = parseContent(raw());
    const told = new Set(
      SEEDS.slice(0, 40).map((seed) => {
        const run = startRun({ seed, content });
        run.choose(answer("offer", "shake"));
        const view = playOn(run, (v) => v.step.kind === "notice");
        return JSON.stringify(view.step);
      }),
    );

    expect(told.size).toBe(1);
  });

  it("can fail on their side, and then they owe the player", () => {
    const run = startRun({ seed: 3, content: parseContent(raw({ gives: 0 })) });
    run.choose(answer("offer", "shake"));

    const view = playOn(run, (v) => v.month === 2 && v.step.kind !== "notice");

    expect(view.favours).toEqual(["OWES-YOU Ben Bird: BEN-LET-YOU-DOWN"]);
  });

  it("left undone on the player's side, behaves like a broken Promise", () => {
    const run = startRun({ seed: 4, content: parseContent(raw()) });
    run.choose(answer("offer", "shake"));
    playOn(
      run,
      (v) => v.step.kind === "notification" && v.step.id === "word-due",
    );

    const view = run.choose(answer("word-due", "not-do-it"));

    expect(view.deals[0]?.status).toBe("D-BROKEN");
    expect(view.favours).toContain("YOU-OWE Ben Bird: YOU-LET-BEN-DOWN");
    expect(
      readHiddenTruth(run).memories.some(
        (m) => m.character === "ben" && m.about === "broke",
      ),
    ).toBe(true);
  });

  it("is shown on the results screen with what it was really worth", () => {
    const run = startRun({ seed: 5, content: parseContent(raw()) });
    run.choose(answer("offer", "shake"));

    const view = playOn(run, (v) => v.step.kind === "results");
    if (view.step.kind !== "results") throw new Error("No results.");

    expect(view.step.deals[0]?.worth).toMatch(/^WORTH-(LANDED|NOTHING)$/);
  });
});

describe("favours owed", () => {
  it("are paid back by a Move that says so, and then no longer shown", () => {
    const written = raw();
    const paid = {
      ...written,
      moves: [
        {
          id: "pay-back",
          from: "Ben",
          title: "PAY-BACK",
          body: "Ben calls it in.",
          when: { youOwe: "ben" },
          priority: true,
          repays: "ben",
        },
      ],
    };
    const run = startRun({ seed: 4, content: parseContent(paid) });
    run.choose(answer("offer", "shake"));
    playOn(
      run,
      (v) => v.step.kind === "notification" && v.step.id === "word-due",
    );
    run.choose(answer("word-due", "not-do-it"));

    expect(run.view().favours).toContain("YOU-OWE Ben Bird: YOU-LET-BEN-DOWN");
    const landed = playOn(
      run,
      (v) => v.step.kind === "move" && v.step.title === "PAY-BACK",
    );
    expect(landed.step.kind).toBe("move");
    expect(landed.favours).toEqual([]);
  });

  it("are part of the Power Map, and never shown unless the player is party", () => {
    const content = parseContent(raw({ favours: 4, gives: 0 }));
    let dealt = 0;
    for (const seed of SEEDS.slice(0, 40)) {
      const run = startRun({ seed, content });
      dealt += readHiddenTruth(run).powerMap.favours.length;
      const seen: string[] = [JSON.stringify(run.view())];
      seen.push(JSON.stringify(run.choose(answer("offer", "shake"))));
      let view = run.view();
      while (view.step.kind !== "results") {
        const next = view.choices[0];
        if (!next) break;
        view = run.choose(next);
        if (view.step.kind !== "results") seen.push(JSON.stringify(view));
      }

      for (const shown of seen) expect(shown).not.toContain("SECRET-FAVOUR");
      if (view.step.kind !== "results") throw new Error("No results.");
      expect(view.step.favours.some((f) => f.includes("SECRET-FAVOUR"))).toBe(
        readHiddenTruth(run).powerMap.favours.some((f) => f.owes !== "you"),
      );
    }

    expect(dealt).toBeGreaterThan(0);
  });
});

/** Plays plainly to month 3's town hall, makes the Deal, and plays to the end. */
function goodWordRun(seed: number) {
  const run = startRun({ seed, content: gameContent });
  let view = run.view();
  while (view.step.kind !== "scene" || view.step.id !== "town-hall") {
    view = run.choose(plainChoice(view));
  }
  run.choose({
    type: "scene",
    sceneId: "town-hall",
    optionId: "deal-with-the-coordinator",
  });
  view = run.view();
  while (view.choices.length > 0) view = run.choose(plainChoice(view));
  if (view.step.kind !== "results") throw new Error("No results.");
  return view.step.deals[0]?.worth ?? "";
}

describe("the real Deals", () => {
  it("are offered in the game", () => {
    const offered = gameContent.scenes.flatMap((s) =>
      s.options.flatMap((o) => o.deal ?? []),
    );

    expect(new Set(offered).size).toBe(gameContent.deals?.items.length);
  });

  // tests/e2e/deal.spec.ts plays these two deals.
  it("keeps the good word working on one seed and not on another", () => {
    expect(goodWordRun(2)).toMatch(/real sway/);
    expect(goodWordRun(3)).toMatch(/no sway/);
  });
});
