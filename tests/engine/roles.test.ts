import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { parseContent, startRun, type Content } from "../../src/engine";
import { findOutFixtureRaw, sceneFixtureRaw } from "./fixture";

const LIKELY = { believer: 4, incompetent: 2, practitioner: 1 };

function rolesFixtureRaw() {
  const raw = sceneFixtureRaw();
  const [ana, ben, cal] = raw.characters;
  if (!ana || !ben || !cal) throw new Error("The fixture has no Characters.");
  ana.role = "chair";
  ben.role = "minute-taker";
  cal.role = "clerk";
  raw.behaviours = [
    { id: "anyone", text: "{who} IS-LATE.", likelihood: LIKELY },
    {
      id: "overruns",
      text: "{who} OVERRUNS.",
      roles: ["chair"],
      likelihood: LIKELY,
    },
    {
      id: "edits-minutes",
      text: "{who} EDITS-MINUTES.",
      roles: ["minute-taker"],
      likelihood: LIKELY,
    },
    {
      id: "files",
      text: "{who} FILES.",
      roles: ["clerk"],
      likelihood: LIKELY,
    },
  ];
  return raw;
}

function openMeeting(seed: number, content: Content) {
  const run = startRun({ seed, content });
  const view = run.choose({ type: "action", actionId: "meeting" });
  if (view.step.kind !== "scene") throw new Error(view.step.kind);
  return view.step;
}

describe("behaviour that belongs to a role", () => {
  it("is shown only by a Character with that role", () => {
    const content = parseContent(rolesFixtureRaw());
    const allowed = new Map([
      ["OVERRUNS", "Ana Abel"],
      ["EDITS-MINUTES", "Ben Bird"],
      ["FILES", "Cal Cope"],
    ]);
    const seen = new Set<string>();

    for (let seed = 1; seed <= 300; seed++) {
      for (const shown of openMeeting(seed, content).behaviours) {
        const [word] = /[A-Z-]{3,}/.exec(shown.text) ?? [""];
        seen.add(word);
        const owner = allowed.get(word);
        if (owner !== undefined) expect(shown.who).toBe(owner);
      }
    }

    expect(seen).toEqual(new Set([...allowed.keys(), "IS-LATE"]));
  });

  it("is never shown out of role with the game's own content", () => {
    const role = new Map(gameContent.characters.map((c) => [c.called, c.role]));
    let shownInRole = 0;

    for (let seed = 1; seed <= 400; seed++) {
      const run = startRun({ seed, content: gameContent });
      let view = run.view();
      while (view.step.kind !== "scene") {
        const meeting = view.choices.find(
          (c) => c.type === "action" && c.actionId === "meeting",
        );
        const next = meeting ?? view.choices[0];
        if (!next) throw new Error(`Stuck at ${view.step.kind}.`);
        view = run.choose(next);
      }
      for (const shown of view.step.behaviours) {
        const written = gameContent.behaviours.find(
          (b) =>
            b.text.replaceAll("{who}", shown.who).toLowerCase() ===
            shown.text.toLowerCase(),
        );
        if (!written) throw new Error(`Unknown sign: ${shown.text}`);
        const { roles } = written;
        if (roles === undefined) continue;
        shownInRole += 1;
        expect(roles).toContain(role.get(shown.who));
      }
    }

    expect(shownInRole).toBeGreaterThan(100);
  });
});

describe("the game's roles", () => {
  it("gives each Character a role with a behaviour nobody else can show", () => {
    for (const { id, role } of gameContent.characters) {
      expect(role, id).toBeDefined();
      const own = gameContent.behaviours.filter(
        (b) => b.roles?.length === 1 && b.roles[0] === role,
      );
      expect(own.length, id).toBeGreaterThanOrEqual(1);
    }
  });

  it("can show each role's own behaviours from at least two kinds", () => {
    const owned = gameContent.behaviours.filter((b) => b.roles !== undefined);
    expect(owned.length).toBeGreaterThanOrEqual(5);
    for (const { id, likelihood } of owned) {
      const kinds = Object.values(likelihood).filter((l) => l > 0);
      expect(kinds.length, id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("roles in content", () => {
  it("rejects a behaviour for a role that nobody has", () => {
    const raw = rolesFixtureRaw();
    const overruns = raw.behaviours[1];
    if (overruns) overruns.roles = ["chiar"];

    expect(() => parseContent(raw)).toThrow(/unknown role "chiar"/);
  });

  it("rejects a role with no behaviour of its own", () => {
    const raw = rolesFixtureRaw();
    raw.behaviours = raw.behaviours.filter((b) => b.id !== "files");

    expect(() => parseContent(raw)).toThrow(/"clerk" has no behaviour/);
  });

  it("rejects a role's behaviour that only one kind can show", () => {
    const raw = rolesFixtureRaw();
    const overruns = raw.behaviours[1];
    if (overruns) {
      overruns.likelihood = { believer: 0, incompetent: 3, practitioner: 0 };
    }

    expect(() => parseContent(raw)).toThrow(/only one kind/);
  });

  it("rejects a Character who would have nothing to show for a kind", () => {
    const raw = rolesFixtureRaw();
    raw.behaviours = raw.behaviours.map((b) => ({
      ...b,
      likelihood:
        b.id === "edits-minutes"
          ? LIKELY
          : { believer: 0, incompetent: 3, practitioner: 3 },
    }));

    expect(() => parseContent(raw)).toThrow(/ana.*believer/);
  });
});

describe("how running text refers to people", () => {
  function calledFixtureRaw() {
    const raw = rolesFixtureRaw();
    const [ana, ben, cal] = raw.characters;
    if (!ana || !ben || !cal) throw new Error("The fixture has no Characters.");
    ana.called = "your boss";
    ben.called = "the analyst";
    cal.called = "the clerk";
    const scene = raw.scenes[0];
    if (scene) {
      scene.signs = [
        { label: "Interrupts", text: "{holder} talks over {ignored}." },
        {
          label: "Ignored",
          text: "Later, {ignored} leaves. {ignored} is sad.",
        },
      ];
    }
    return raw;
  }

  it("says what they are called, with a capital only where a sentence starts", () => {
    const content = parseContent(calledFixtureRaw());
    const { signs, behaviours } = openMeeting(8, content);

    expect(JSON.stringify([signs, behaviours])).not.toMatch(/Ana|Ben|Cal/);
    expect(signs[0]?.text).toMatch(
      /^(Your boss|The analyst|The clerk) talks over (your boss|the analyst|the clerk)\.$/,
    );
    expect(signs[1]?.text).toMatch(
      /^Later, (your boss|the analyst|the clerk) leaves\. (Your boss|The analyst|The clerk) is sad\.$/,
    );
    expect(behaviours.map((b) => b.who).sort()).toEqual([
      "the analyst",
      "the clerk",
      "your boss",
    ]);
  });

  it("keeps names on the Org Chart and in the cast", () => {
    const content = parseContent(calledFixtureRaw());
    const run = startRun({ seed: 1, content });

    expect(run.view().orgChart.map((e) => e.name)).toContain("Ana Abel");
    expect(openMeeting(1, content).cast.map((c) => c.name)).toContain(
      "Ana Abel",
    );
  });

  it("falls back on the name when nothing else is written", () => {
    const { behaviours } = openMeeting(1, parseContent(rolesFixtureRaw()));

    expect(behaviours.map((b) => b.who)).toEqual([
      "Ana Abel",
      "Ben Bird",
      "Cal Cope",
    ]);
  });

  it("never names a Character in the game's running text", () => {
    const names = gameContent.characters.flatMap((c) => c.name.split(" "));
    const { sources } = gameContent;
    const running = {
      actions: gameContent.actions,
      behaviours: gameContent.behaviours,
      boss: gameContent.boss,
      overHead: gameContent.overHead,
      missed: {
        forgotten: gameContent.demands?.missed?.forgotten,
        options: gameContent.demands?.missed?.options,
        body: gameContent.demands?.missed?.chased.body,
        actions: gameContent.demands?.missed?.actions.map((a) => [
          a.title,
          a.body,
          a.subject,
          a.ask,
        ]),
      },
      dialogs: gameContent.dialogs,
      moves: gameContent.moves,
      notebook: gameContent.notebook,
      notifications: gameContent.notifications,
      officialStory: gameContent.officialStory,
      scenes: gameContent.scenes,
      ui: gameContent.ui,
      findOut: sources.methods,
      voices: sources.voices,
    };
    const strings = (value: unknown, key = ""): string[] => {
      if (typeof value === "string") return key === "from" ? [] : [value];
      if (Array.isArray(value)) return value.flatMap((v) => strings(v));
      if (typeof value !== "object" || value === null) return [];
      return Object.entries(value).flatMap(([k, v]) => strings(v, k));
    };

    for (const [part, written] of Object.entries(running)) {
      for (const line of strings(written)) {
        for (const name of names) expect(line, part).not.toContain(name);
      }
    }
  });

  it("calls every Character in the game by what they do", () => {
    for (const { id, called } of gameContent.characters) {
      expect(called, id).toBeDefined();
    }
  });
});

describe("how a source talks", () => {
  function voicesFixtureRaw() {
    const { characters, behaviours } = rolesFixtureRaw();
    const raw = findOutFixtureRaw();
    return {
      ...raw,
      characters,
      behaviours,
      sources: {
        ...raw.sources,
        voices: {
          chair: ["CHAIR-ONE {said}", "CHAIR-TWO {said}"],
          "minute-taker": ["MINUTES-ONE {said}"],
        } as Record<string, string[]>,
      },
    };
  }

  function claimFrom(seed: number, sourceId: string, content: Content) {
    const run = startRun({ seed, content });
    run.choose({ type: "action", actionId: "copier" });
    const subjectId = sourceId === "cal" ? "ana" : "cal";
    const view = run.choose({ type: "find-out", sourceId, subjectId });
    if (view.step.kind !== "claim") throw new Error(view.step.kind);
    return { run, text: view.step.text };
  }

  it("depends on the source's role", () => {
    const content = parseContent(voicesFixtureRaw());
    for (let seed = 1; seed <= 40; seed++) {
      expect(claimFrom(seed, "ana", content).text).toMatch(/^CHAIR-/);
      expect(claimFrom(seed, "ben", content).text).toMatch(/^MINUTES-/);
    }
  });

  it("leaves a role with no voice speaking plainly", () => {
    const { text } = claimFrom(1, "cal", parseContent(voicesFixtureRaw()));

    expect(text).not.toMatch(/CHAIR|MINUTES/);
  });

  it("says nothing of whether the claim is true", () => {
    const content = parseContent(voicesFixtureRaw());
    const seen = new Map<string, Set<string>>();
    for (let seed = 1; seed <= 400; seed++) {
      const { run, text } = claimFrom(seed, "ana", content);
      let view = run.view();
      while (view.choices.length > 0) {
        const choice = view.choices.at(-1);
        if (!choice) break;
        view = run.choose(choice);
      }
      if (view.step.kind !== "results") throw new Error(view.step.kind);
      const verdict = view.step.claims[0]?.verdict ?? "";
      const voice = text.split(" ")[0] ?? "";
      seen.set(verdict, (seen.get(verdict) ?? new Set()).add(voice));
    }

    expect(seen.size).toBeGreaterThanOrEqual(2);
    for (const voices of seen.values()) {
      expect(voices).toEqual(new Set(["CHAIR-ONE", "CHAIR-TWO"]));
    }
  });

  it("gives every role in the game a voice of its own", () => {
    const { voices } = gameContent.sources;
    const heard = new Set<string>();
    for (const { id, role } of gameContent.characters) {
      const lines = voices[role ?? ""] ?? [];
      expect(lines.length, id).toBeGreaterThanOrEqual(2);
      for (const line of lines) {
        expect(heard.has(line), line).toBe(false);
        heard.add(line);
      }
    }
  });

  it("rejects a voice for a role that nobody has", () => {
    const raw = voicesFixtureRaw();
    raw.sources.voices.chiar = ["{said}"];

    expect(() => parseContent(raw)).toThrow(/unknown role "chiar"/);
  });

  it("rejects a voice that leaves out what was said", () => {
    const raw = voicesFixtureRaw();
    raw.sources.voices.chair = ["Nothing to say."];

    expect(() => parseContent(raw)).toThrow(/\{said\}/);
  });
});
