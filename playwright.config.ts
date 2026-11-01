import { availableParallelism } from "node:os";
import { defineConfig } from "@playwright/test";

const port = 4179;
const vite = "node node_modules/vite/bin/vite.js";

export default defineConfig({
  testDir: "tests/e2e",
  // full-run.spec.ts clicks through every month, which takes a slow machine a while.
  timeout: 60_000,
  // Software WebGL fights itself for the processor. With 20 threads, 3 workers
  // take as long in all as 10, but the slowest test falls from 51 s to 21 s.
  // Half the threads is Playwright's own default, so CI is unchanged.
  workers: Math.max(1, Math.min(3, Math.floor(availableParallelism() / 2))),
  maxFailures: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: `http://localhost:${String(port)}`,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    launchOptions: {
      // WebGL on machines with no GPU, such as CI, needs the software renderer.
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    // Its own mode and folder: only this build can start at a later month. Not
    // npx, which here took from 2 s to over 30 s to start, against 0.5 s for this.
    command: `${vite} build --mode e2e --outDir dist-e2e && ${vite} preview --outDir dist-e2e --port ${String(port)} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
