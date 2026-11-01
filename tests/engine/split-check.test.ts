import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { startRun } from "../../src/engine";

const goldenPath = new URL("split-check.golden.json", import.meta.url);

/** Every player view of a whole scripted run, as one digest. */
function digestOfRun(seed: number, script: number): string {
  const run = startRun({ seed, content: gameContent });
  const hash = createHash("sha256");
  let view = run.view();
  hash.update(JSON.stringify(view));
  for (let turn = 0; view.choices.length > 0; turn++) {
    const at = (Math.imul(turn + 1, 2654435761 + script * 2) >>> 7) ^ script;
    const choice = view.choices[Math.abs(at) % view.choices.length];
    if (!choice) throw new Error("No choice.");
    view = run.choose(choice);
    hash.update(JSON.stringify(view));
  }
  return hash.digest("hex");
}

function digests() {
  const all: Record<string, string> = {};
  for (const seed of [1, 2, 4, 8, 13, 16, 77, 4242]) {
    for (const script of [0, 1, 2]) {
      all[`seed ${String(seed)}, script ${String(script)}`] = digestOfRun(
        seed,
        script,
      );
    }
  }
  return all;
}

// The player views recorded from the engine as it stood before it was split.
it("gives the same player views as before the engine was split", () => {
  if (process.env.WRITE_GOLDEN) {
    writeFileSync(goldenPath, `${JSON.stringify(digests(), null, 2)}\n`);
  }
  const golden: unknown = JSON.parse(readFileSync(goldenPath, "utf8"));
  expect(digests()).toEqual(golden);
});
