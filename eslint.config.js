import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const restrict = (patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

export default tseslint.config(
  { ignores: ["dist/", "playwright-report/", "test-results/", ".claude/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/ui/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // These two plain scripts sit outside tsconfig.json, so type-aware rules
  // cannot run on them. Review if either grows beyond start-up plumbing.
  {
    files: ["eslint.config.js", "scripts/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: { console: "readonly", process: "readonly" },
    },
  },
  // The engine stays headless, so the tower can be replaced.
  {
    files: ["src/engine/**/*.ts"],
    rules: restrict([
      {
        group: [
          "three",
          "three/*",
          "react",
          "react/*",
          "react-dom",
          "react-dom/*",
        ],
        message: "The engine imports neither Three.js nor React.",
      },
      {
        group: [
          "../ui",
          "../ui/*",
          "../tower",
          "../tower/*",
          "../content",
          "../content/*",
        ],
        message: "The engine depends on nothing above it.",
      },
    ]),
  },
  // The interface reads only the player view, and the tower holds no rules.
  {
    files: ["src/ui/**/*.{ts,tsx}", "src/tower/**/*.ts", "src/content/**/*.ts"],
    rules: restrict([
      {
        group: ["**/engine/*"],
        message:
          "Use the engine's public interface. Only tests may read the hidden truth.",
      },
    ]),
  },
);
