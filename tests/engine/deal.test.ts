import { describe, expect, it } from "vitest";
import {
  parseContent,
  startRun,
  type Choice,
  type Content,
  type PlayerView,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { emptyMonth, emptyMonthRaw, sceneFixtureRaw } from "./fixture";

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

const dealOf = (seed: number, content = emptyMonth()) =>
  readHiddenTruth(startRun({ seed, content })).characters;

/** Takes the first choice offered until the run ends. */
function playWhole(seed: number, content: Content) {
  const run = startRun({ seed, content });
  const views = [run.view()];
  for (;;) {
    const choice: Choice | undefined = views.at(-1)?.choices[0];
    if (!choice) return { run, views };
    views.push(run.choose(choice));
  }
}

function resultsOf(view: PlayerView | undefined) {
  if (view?.step.kind !== "results") throw new Error(view?.step.kind);
  return view.step;
}

/** A meeting whose text and results take nothing from the deal. */
function blindToTheDeal(): Content {
  const raw = sceneFixtureRaw();
  const scene = raw.scenes[0];
  if (!scene) throw new Error("The fixture has no Scene.");
  scene.signs = [{ label: "Sign", text: "The projector hums." }];
  scene.options = [
    { id: "nod", label: "Nod", results: [{ body: "You nod." }] },
  ];
  return parseContent(raw);
}

describe("the deal", () => {
  it("gives every Character a kind", () => {
    for (const seed of SEEDS) {
      const deal = dealOf(seed);
      expect(deal.map((c) => c.id)).toEqual(["ana", "ben", "cal"]);
      for (const { kind } of deal) {
        expect(["believer", "incompetent", "practitioner"]).toContain(kind);
      }
    }
  });

  it("gives most Characters a Hidden Fact, written for them", () => {
    for (const seed of SEEDS) {
      const withFacts = dealOf(seed).filter((c) => c.fact !== null);
      expect(withFacts).toHaveLength(2);
      for (const c of withFacts) {
        const name = { ana: "Ana Abel", ben: "Ben Bird", cal: "Cal Cope" }[
          c.id
        ];
        expect(c.fact?.text).toContain(name);
        expect(c.fact?.text).not.toContain("{name}");
      }
    }
  });

  it("never gives two Characters the same Hidden Fact", () => {
    for (const seed of SEEDS) {
      const ids = dealOf(seed).flatMap((c) => (c.fact ? [c.fact.id] : []));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("always contains a Practitioner, even if the weights say otherwise", () => {
    const raw = emptyMonthRaw();
    raw.hiddenTruth.kinds.practitioner.weight = 0;
    const content = parseContent(raw);

    for (const seed of SEEDS) {
      const kinds = dealOf(seed, content).map((c) => c.kind);
      expect(kinds.filter((k) => k === "practitioner")).toHaveLength(1);
    }
  });

  it("gives a restricted Hidden Fact only to the Characters it names", () => {
    const raw = emptyMonthRaw();
    raw.hiddenTruth.facts.push({
      id: "only-ana",
      text: "ONLY {name}",
      characters: ["ana"],
    });
    const content = parseContent(raw);
    const holders = new Set(
      SEEDS.flatMap((seed) =>
        dealOf(seed, content).filter((c) => c.fact?.id === "only-ana"),
      ).map((c) => c.id),
    );

    expect(holders).toEqual(new Set(["ana"]));
  });

  it("deals differently for different seeds", () => {
    const kinds = new Set(
      SEEDS.map((seed) =>
        dealOf(seed)
          .map((c) => c.kind)
          .join(),
      ),
    );
    const facts = new Set(
      SEEDS.map((seed) =>
        dealOf(seed)
          .map((c) => c.fact?.id)
          .join(),
      ),
    );

    expect(kinds.size).toBeGreaterThan(3);
    expect(facts.size).toBeGreaterThan(3);
  });

  it("deals the same for the same seed", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      expect(dealOf(seed)).toEqual(dealOf(seed));
    }
  });

  it.each([
    [
      "more Practitioners than Characters",
      (raw: Raw) => {
        raw.hiddenTruth.minPractitioners = 4;
      },
      /Practitioners/,
    ],
    [
      "no Practitioner guaranteed",
      (raw: Raw) => {
        raw.hiddenTruth.minPractitioners = 0;
      },
      /minPractitioners/,
    ],
    [
      "a Hidden Fact for only some of the cast",
      (raw: Raw) => {
        raw.hiddenTruth.charactersWithFact = 1;
      },
      /most/,
    ],
    [
      "too few Hidden Facts to deal",
      (raw: Raw) => {
        raw.hiddenTruth.facts = raw.hiddenTruth.facts.slice(0, 1);
      },
      /Hidden Facts/,
    ],
    [
      "a Hidden Fact that does not name its Character",
      (raw: Raw) => {
        raw.hiddenTruth.facts.push({ id: "x", text: "Nobody in particular." });
      },
      /\{name\}/,
    ],
    [
      "a Hidden Fact with an unknown token",
      (raw: Raw) => {
        raw.hiddenTruth.facts.push({ id: "x", text: "{name} and {boss}." });
      },
      /boss/,
    ],
    [
      "a Hidden Fact for an unknown Character",
      (raw: Raw) => {
        raw.hiddenTruth.facts.push({
          id: "x",
          text: "{name}.",
          characters: ["zed"],
        });
      },
      /zed/,
    ],
    [
      "a kind that can never be dealt by weight alone",
      (raw: Raw) => {
        raw.hiddenTruth.kinds.believer.weight = 0;
        raw.hiddenTruth.kinds.incompetent.weight = 0;
        raw.hiddenTruth.kinds.practitioner.weight = 0;
      },
      /weight/,
    ],
  ])("rejects a deal with %s", (_name, breakIt, message) => {
    const raw = emptyMonthRaw();
    breakIt(raw);

    expect(() => parseContent(raw)).toThrow(message);
  });
});

type Raw = ReturnType<typeof emptyMonthRaw>;

describe("the results screen", () => {
  it("replaces the end of the run, with no further choices", () => {
    const { views } = playWhole(1, emptyMonth());

    expect(views.at(-2)?.step.kind).toBe("story");
    expect(views.at(-1)?.step.kind).toBe("results");
    expect(views.at(-1)?.choices).toEqual([]);
  });

  it("shows who was really who, including every Hidden Fact", () => {
    const content = emptyMonth();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { run, views } = playWhole(seed, content);
      const { characters } = resultsOf(views.at(-1));

      expect(characters).toEqual(
        readHiddenTruth(run).characters.map((dealt) => {
          const known = content.characters.find((c) => c.id === dealt.id);
          return {
            name: known?.name,
            title: known?.title,
            kind: content.hiddenTruth.kinds[dealt.kind].label,
            fact: dealt.fact?.text ?? null,
          };
        }),
      );
    }
  });
});

describe("the player view before the run ends", () => {
  it("is the same whatever was dealt, apart from the seed", () => {
    const content = blindToTheDeal();
    const beforeTheEnd = (seed: number) => {
      const { run, views } = playWhole(seed, content);
      return {
        deal: readHiddenTruth(run),
        views: views
          .filter((v) => v.step.kind !== "results")
          .map((v) => ({ ...v, seed: 0 })),
      };
    };

    const first = beforeTheEnd(1);
    const others = [2, 3, 4, 5, 6, 7, 8].map(beforeTheEnd);

    expect(
      others.some((o) => JSON.stringify(o.deal) !== JSON.stringify(first.deal)),
    ).toBe(true);
    for (const other of others) expect(other.views).toEqual(first.views);
  });

  it("never holds a dealt kind or Hidden Fact at any step", () => {
    const content = emptyMonth();
    const labels = Object.values(content.hiddenTruth.kinds).map((k) => k.label);
    for (const seed of [1, 2, 3, 4, 5]) {
      const { run, views } = playWhole(seed, content);
      const dealt = readHiddenTruth(run).characters;
      for (const view of views.slice(0, -1)) {
        const seen = JSON.stringify(view);
        for (const label of labels) expect(seen).not.toContain(label);
        for (const { fact } of dealt) {
          if (fact) expect(seen).not.toContain(fact.text);
        }
      }
    }
  });
});
