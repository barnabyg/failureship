import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const restrict = (patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

export default tseslint.config(
  { ignores: ["dist/", "playwright-report/", "test-results/"] },
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
        group: ["**/ui/**", "**/tower/**", "**/content/**"],
        message: "The engine depends on nothing above it.",
      },
    ]),
  },
  // The interface reads only the player view, and the tower holds no rules.
  {
    files: ["src/ui/**/*.{ts,tsx}", "src/tower/**/*.ts", "src/content/**/*.ts"],
    rules: restrict([
      {
        group: ["**/engine/hidden-truth", "**/engine/hidden-truth.ts"],
        message: "Only tests may read the hidden truth in Phase 1.",
      },
    ]),
  },
);
