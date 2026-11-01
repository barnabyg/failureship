import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    // Three.js and the game's text are the bundle, and it has one screen, so a
    // single chunk is fine. Review if hosting is ever added.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ["tests/engine/**/*.test.ts", "tests/tower/**/*.test.ts"],
    bail: process.env.CI ? 1 : 0,
    // Some tests play hundreds of whole nine-month runs.
    testTimeout: 30_000,
  },
});
