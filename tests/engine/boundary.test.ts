import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import * as engine from "../../src/engine";

describe("the interface and the hidden truth", () => {
  it("offers no way to read the hidden truth through the engine's interface", () => {
    expect(Object.keys(engine)).not.toContain("readHiddenTruth");
    expect(Object.keys(engine)).not.toContain("hiddenTruthOf");
  });

  it.each(["../engine/hidden-truth", "../engine/run"])(
    "fails lint if the interface imports %s",
    async (source) => {
      const [result] = await new ESLint().lintText(
        `export * from "${source}";\n`,
        { filePath: "src/ui/App.tsx" },
      );

      expect(result?.messages.map((m) => m.ruleId)).toContain(
        "no-restricted-imports",
      );
    },
    60_000,
  );
});
