import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { parseContent, startRun, type Content } from "../../src/engine";
import { sceneFixtureRaw } from "./fixture";

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
      ["OVERRUNS", "ana"],
      ["EDITS-MINUTES", "ben"],
      ["FILES", "cal"],
    ]);
    const seen = new Set<string>();

    for (let seed = 1; seed <= 300; seed++) {
      for (const shown of openMeeting(seed, content).behaviours) {
        const [word] = /[A-Z-]{3,}/.exec(shown.text) ?? [""];
        seen.add(word);
        const owner = allowed.get(word);
        if (owner !== undefined) expect(shown.character).toBe(owner);
      }
    }

    expect(seen).toEqual(new Set([...allowed.keys(), "IS-LATE"]));
  });

  it("is never shown out of role with the game's own content", () => {
    const role = new Map(gameContent.characters.map((c) => [c.id, c.role]));
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
        const roles = gameContent.behaviours.find(
          (b) =>
            b.text.replaceAll("{who}", shown.who).toLowerCase() ===
            shown.text.toLowerCase(),
        )?.roles;
        if (roles === undefined) continue;
        shownInRole += 1;
        expect(roles).toContain(role.get(shown.character));
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

  it("uses the role, capitalised only where a sentence starts", () => {
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

  it("falls back on the name when no role is written", () => {
    const { behaviours } = openMeeting(1, parseContent(rolesFixtureRaw()));

    expect(behaviours.map((b) => b.who)).toEqual([
      "Ana Abel",
      "Ben Bird",
      "Cal Cope",
    ]);
  });

  it("never names a Character in the game's running text", () => {
    const folder = path.join(import.meta.dirname, "../../content");
    const names = gameContent.characters.flatMap((c) => c.name.split(" "));
    const running = [
      "actions",
      "behaviours",
      "boss",
      "dialogs",
      "moves",
      "notebook",
      "notifications",
      "official-story",
      "scenes",
    ];
    const strings = (value: unknown, key = ""): string[] => {
      if (typeof value === "string") return key === "from" ? [] : [value];
      if (Array.isArray(value)) return value.flatMap((v) => strings(v));
      if (typeof value !== "object" || value === null) return [];
      return Object.entries(value).flatMap(([k, v]) => strings(v, k));
    };

    for (const file of running) {
      const written = readFileSync(path.join(folder, `${file}.json`), "utf8");
      for (const line of strings(JSON.parse(written))) {
        for (const name of names) expect(line, file).not.toContain(name);
      }
    }
  });

  it("calls every Character in the game by what they do", () => {
    for (const { id, called } of gameContent.characters) {
      expect(called, id).toBeDefined();
    }
  });
});
