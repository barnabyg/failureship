import { describe, expect, it } from "vitest";
import {
  parseContent,
  startRun,
  type Content,
  type Kind,
  type PlayerView,
} from "../../src/engine";
import { readHiddenTruth } from "../../src/engine/hidden-truth";
import { capitalised } from "../../src/engine/say";
import { calledAtStart } from "./fixture";
import { playOut, resultsOf, rivalsRaw, SEEDS } from "./rival-fixture";
import { castOf } from "./scene-view";
import { everySign } from "./scene-view";

/** The meeting, in which someone competing asks the question, as a Move of theirs. */
function askingRaw() {
  const raw = rivalsRaw();
  const meeting = raw.scenes[0];
  if (meeting) {
    Object.assign(meeting, {
      competitor: {
        title: "ASKED-THE-QUESTION",
        family: "attack",
        label: "How it is asked",
        signs: [
          {
            text: "{competitor} HAS IT READY.",
            likelihood: { believer: 1, incompetent: 1, practitioner: 4 },
          },
          {
            text: "{competitor} LOOKS SURPRISED.",
            likelihood: { believer: 4, incompetent: 3, practitioner: 1 },
          },
        ],
      },
    });
    meeting.narration = ["{competitor} ASKS THE QUESTION."];
    const quiet = meeting.options[1];
    if (quiet) quiet.results = [{ body: "YOU ANSWER {competitor}." }];
  }
  return raw;
}

/** Plays on to the first Scene. */
function toScene(content: Content, seed: number) {
  const run = startRun({ seed, content });
  let view = run.view();
  while (view.step.kind !== "scene") {
    const next = view.choices[0];
    if (!next) throw new Error("No Scene.");
    view = run.choose(next);
  }
  return { run, view };
}

/** Whom the Scene's first line names, of those given. */
function namedIn(content: Content, view: PlayerView, ids: readonly string[]) {
  if (view.step.kind !== "scene") throw new Error("No Scene.");
  const told = view.step.narration[0];
  return ids.find(
    (id) =>
      told === `${capitalised(calledAtStart(content, id))} ASKS THE QUESTION.`,
  );
}

describe("a question in a Scene from someone competing", () => {
  it("is asked by someone competing, of any kind, and credited only to a Rival", () => {
    const content = parseContent(askingRaw());
    const asked = { rival: 0, other: 0, practitioner: 0, otherKind: 0 };

    for (const seed of SEEDS) {
      const run = startRun({ seed, content });
      const views = playOut(run);
      const truth = readHiddenTruth(run);
      const first = views.find((v) => v.step.kind === "scene");
      if (!first) throw new Error("No Scene.");
      // Ana and Ben always compete, and Cal never does.
      const asker = namedIn(content, first, ["ana", "ben"]);
      expect(asker, `seed ${String(seed)}`).toBeDefined();
      // Whoever asks is in the room.
      const name = content.characters.find((c) => c.id === asker)?.name;
      expect(first.step.kind === "scene" && castOf(first.step)).toContainEqual(
        expect.objectContaining({ name }),
      );
      const kind = truth.characters.find((c) => c.id === asker)?.kind;
      if (kind === "practitioner") asked.practitioner += 1;
      else asked.otherKind += 1;
      const rival = truth.rivals.find((r) => r.character === asker);
      if (rival) {
        asked.rival += 1;
        expect(rival.did).toContainEqual({ month: 1, move: "meeting" });
        const listed = resultsOf(views).rivals.flatMap((r) => r.did);
        expect(listed).toContainEqual({
          month: 1,
          text: "ASKED-THE-QUESTION",
          family: "ATTACK",
        });
      } else {
        asked.other += 1;
        expect(truth.rivals.flatMap((r) => r.did)).not.toContainEqual({
          month: 1,
          move: "meeting",
        });
      }
    }

    expect(asked.rival).toBeGreaterThan(0);
    expect(asked.other).toBeGreaterThan(0);
    // Practitioners are a third of those dealt here, and ask more than that.
    expect(asked.practitioner).toBeGreaterThan(asked.otherKind / 2);
  });

  it("names the same person in what is said back", () => {
    const content = parseContent(askingRaw());
    for (const seed of SEEDS.slice(0, 40)) {
      const { run, view } = toScene(content, seed);
      const asker = namedIn(content, view, ["ana", "ben"]) ?? "";
      const after = run.choose({
        type: "scene",
        sceneId: "meeting",
        optionId: "stay-quiet",
      });

      expect(after.result).toMatchObject({
        body: `YOU ANSWER ${calledAtStart(content, asker)}.`,
      });
    }
  });

  it("shows how they asked by their kind's odds, so that no way of asking settles a kind", () => {
    const content = parseContent(askingRaw());
    const kindsBehind = new Map<string, Set<Kind>>();
    for (const seed of SEEDS) {
      const { run, view } = toScene(content, seed);
      if (view.step.kind !== "scene") throw new Error("No Scene.");
      const asker = namedIn(content, view, ["ana", "ben"]);
      const kind = readHiddenTruth(run).characters.find(
        (c) => c.id === asker,
      )?.kind;
      const sign = everySign(view.step).find(
        (s) => s.label === "How it is asked",
      );
      const way = sign?.text.split(" ").slice(-2).join(" ") ?? "";
      expect(sign, `seed ${String(seed)}`).toBeDefined();
      if (kind)
        kindsBehind.set(way, (kindsBehind.get(way) ?? new Set()).add(kind));
    }

    expect([...kindsBehind.keys()].sort()).toEqual([
      "IT READY.",
      "LOOKS SURPRISED.",
    ]);
    for (const kinds of kindsBehind.values()) {
      expect(kinds.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("is asked by the bystander when nobody competes, the same in every line", () => {
    const raw = askingRaw();
    raw.rivals.competing = [
      { id: "seat", for: "FOR-SEAT", who: ["cal"], when: { flag: "never" } },
    ];
    // Every Scene's signs mislead, which must not move who asked.
    raw.balance.signsMisleadChance = 1;
    const meeting = raw.scenes[0];
    meeting?.signs.push({ label: "Who answers", text: "{competitor} WAITS." });
    const content = parseContent(raw);
    for (const seed of SEEDS.slice(0, 40)) {
      const { run, view } = toScene(content, seed);
      if (view.step.kind !== "scene") throw new Error("No Scene.");
      const { order } = readHiddenTruth(run).powerMap;
      const present = order.filter((id) => ["ana", "ben", "cal"].includes(id));
      const bystander = present[1] ?? "";
      const said = capitalised(calledAtStart(content, bystander));

      expect(view.step.narration[0]).toBe(`${said} ASKS THE QUESTION.`);
      expect(everySign(view.step)).toContainEqual({
        label: "Who answers",
        text: `${said} WAITS.`,
      });
      expect(readHiddenTruth(run).rivals.flatMap((r) => r.did)).toEqual([]);
    }
  });
});

describe("the data for a question in a Scene", () => {
  it("can be written only in a Scene in which someone competing asks", () => {
    const raw = rivalsRaw();
    if (raw.scenes[0]) raw.scenes[0].narration = ["{competitor} ASKS."];

    expect(() => parseContent(raw)).toThrow(/unknown part "\{competitor\}"/);
  });

  it("needs someone who could compete", () => {
    const raw: Partial<ReturnType<typeof askingRaw>> = askingRaw();
    delete raw.rivals;

    expect(() => parseContent(raw)).toThrow(
      /Scene "meeting" has someone competing ask, but nobody competes/,
    );
  });

  it("needs an id that no Move has", () => {
    const raw = askingRaw();
    raw.moves.push({
      id: "meeting",
      from: "Facilities",
      title: "MOVE-MEETING",
      body: "Plain.",
    });

    expect(() => parseContent(raw)).toThrow(
      /Scene "meeting" has someone competing ask, as Move "meeting" does/,
    );
  });

  it("needs three people present, since the bystander asks when nobody competes", () => {
    const raw = askingRaw();
    const meeting = raw.scenes[0];
    if (meeting) {
      meeting.cast = ["ana", "ben"];
      meeting.signs = [];
      meeting.options.forEach((o) => {
        o.results = [{ body: "PLAIN." }];
      });
    }

    expect(() => parseContent(raw)).toThrow(
      /names parts, which need three people present/,
    );
  });

  it("needs ways of asking that leave every kind possible and none settled", () => {
    const raw = askingRaw();
    const meeting = raw.scenes[0] as unknown as {
      competitor: { signs: { likelihood: Record<Kind, number> }[] };
    };
    const first = meeting.competitor.signs[0];
    if (first)
      first.likelihood = { believer: 0, incompetent: 0, practitioner: 4 };

    expect(() => parseContent(raw)).toThrow(/at least two kinds/);
  });
});
