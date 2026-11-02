import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { ViteDevServer } from "vite";
import { startDevServer } from "./dev-server";

// The game teaches only three Buzzwords so far, so this spec serves the pub with
// more of them. Only the dev server reads content/ as separate files, so it starts
// its own, as broken-content.spec.ts does. content/ on disk is never touched.
const root = path.join(import.meta.dirname, "../..");
const read = (file: string): unknown =>
  JSON.parse(readFileSync(path.join(root, "content", file), "utf8"));

const written = read("buzzwords.json") as { id: string }[];
const extra = [
  "circle back",
  "deep dive",
  "boil the ocean",
  "move the needle",
  "paradigm shift",
  "low-hanging fruit",
  "thought leadership",
].map((term) => ({ id: term.replaceAll(" ", "-"), term, meaning: `${term}.` }));
const buzzwords = [...written, ...extra];

/** The pub teaches these, in this order. */
function pubTeaches(ids: readonly string[]) {
  const notifications = read("notifications.json") as {
    id: string;
    options: { id: string; learns?: string[] }[];
  }[];
  const pub = notifications
    .find((n) => n.id === "pub-invite")
    ?.options.find((o) => o.id === "pub");
  if (!pub) throw new Error("The pub has gone.");
  pub.learns = [...ids];
  return notifications;
}

async function serve(page: Page, file: string, data: unknown) {
  await page.route(`**/content/${file}*`, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export default ${JSON.stringify(data)};`,
    }),
  );
}

let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  ({ server, origin } = await startDevServer({
    cacheDir: "node_modules/.vite-buzzwords",
  }));
});

test.afterAll(async () => {
  await server.close();
});

test.beforeEach(async ({ page }) => {
  await serve(page, "buzzwords.json", buzzwords);
});

test("three Buzzwords all show, with no more to open", async ({ page }) => {
  await serve(page, "notifications.json", pubTeaches(written.map((b) => b.id)));
  await page.goto(`${origin}?seed=1`);
  await page.getByTestId("option-pub").click();

  await expect(page.getByTestId("buzzword")).toHaveText([
    "single source of truth",
    "north star",
    "strategic patience",
  ]);
  await expect(page.getByTestId("open-buzzwords")).toHaveCount(0);
});

test("ten Buzzwords show the latest three, and the rest behind +7 more", async ({
  page,
}) => {
  await serve(
    page,
    "notifications.json",
    pubTeaches(buzzwords.map((b) => b.id)),
  );
  // Narrower than a laptop, since CI's fonts run wider than Windows' do.
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto(`${origin}?seed=1`);
  const status = page.locator(".status");
  const heightOf = () =>
    status.evaluate((header) => header.getBoundingClientRect().height);
  const before = await heightOf();
  await page.getByTestId("option-pub").click();

  const shown = page.getByTestId("buzzword");
  await expect(shown).toHaveText([
    "thought leadership",
    "low-hanging fruit",
    "paradigm shift",
  ]);
  await expect(shown.first()).toHaveClass("buzzword-new");
  await expect(page.getByTestId("open-buzzwords")).toHaveText("+7 more");

  // The header stays on one line: no taller than with no Buzzwords, and no wider.
  expect(await heightOf()).toBe(before);
  expect(
    await status.evaluate((header) => header.scrollWidth <= header.clientWidth),
  ).toBe(true);

  await page.getByTestId("open-buzzwords").click();
  const list = page.getByTestId("buzzword-learned");
  await expect(list).toHaveCount(10);
  await expect(list.first()).toContainText("strategic patience");
  await expect(list.first()).toContainText("Doing nothing, on purpose");
  await expect(list.last()).toContainText("thought leadership");
  await page.getByTestId("close-buzzwords").click();
  await expect(page.getByTestId("buzzword-list")).toHaveCount(0);

  // Nothing stands out once the page is reloaded.
  await page.reload();
  await expect(shown).toHaveCount(3);
  await expect(page.locator(".buzzword-new")).toHaveCount(0);

  // Starting the same seed again, the pub teaches them anew, and they stand out.
  await page.getByTestId("seed-input").fill("1");
  await page.getByTestId("restart-seed").click();
  await page.getByTestId("confirm-leave-yes").click();
  await expect(page.getByTestId("buzzwords")).toHaveCount(0);
  await page.getByTestId("option-pub").click();
  await expect(shown.first()).toHaveClass("buzzword-new");
});
