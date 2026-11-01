import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    // Three.js alone is most of the bundle and the game has one screen, so a
    // single chunk is fine. Review if hosting is ever added.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    include: ["tests/engine/**/*.test.ts"],
    bail: process.env.CI ? 1 : 0,
  },
});
