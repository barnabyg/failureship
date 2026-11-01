import { defineConfig } from "@playwright/test";

const port = 4179;

export default defineConfig({
  testDir: "tests/e2e",
  // A whole run is many clicks, and software WebGL is slow under many workers.
  timeout: 60_000,
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
    command: `npm run build && npx vite preview --port ${String(port)} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
