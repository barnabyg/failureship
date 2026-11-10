import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Under the dev server, a data file that is not JSON fails its request, which
 * leaves a blank page and no error that index.html can see. So the module throws
 * instead, and the page says what is wrong. A build still just fails.
 */
function sayWhichDataFileIsNotJson(): Plugin {
  return {
    name: "say-which-data-file-is-not-json",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      const file = /\/(content\/[^/?]+\.json)(\?|$)/.exec(id)?.[1];
      if (file === undefined) return null;
      try {
        // trimStart also drops the byte order mark some editors add.
        JSON.parse(code.trimStart());
        return null;
      } catch (error) {
        const problem = `${file} is not valid JSON: ${String(error)}`;
        return {
          // The import has to find its default before this can run and throw.
          code: `throw new Error(${JSON.stringify(problem)});
export default null;`,
          moduleType: "js",
        };
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), sayWhichDataFileIsNotJson()],
  build: {
    // Three.js and the game's text are the bundle, and it has one screen, so a
    // single chunk is fine. Review if hosting is ever added.
    chunkSizeWarningLimit: 1600,
  },
  test: {
    bail: process.env.CI ? 1 : 0,
    // Some tests play many whole runs.
    testTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          name: "engine",
          include: ["tests/engine/**/*.test.ts", "tests/tower/**/*.test.ts"],
        },
      },
      // The statistical balance tests, which play hundreds of whole runs each.
      // `npm test` leaves them out, and `npm run verify` and CI run them. Each
      // takes under 30 s here, and the longer timeout is for a slower runner.
      {
        extends: true,
        test: {
          name: "balance",
          include: ["tests/balance/**/*.test.ts"],
          testTimeout: 60_000,
        },
      },
    ],
  },
});
