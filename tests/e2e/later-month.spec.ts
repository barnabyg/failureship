import { expect, test, type Page } from "@playwright/test";
import { startDevServer } from "./dev-server";
import { answerAnyNotification, attendAndFinishMonth } from "./play";

async function whereTheRunIs(page: Page) {
  await page.getByTestId("open-notebook").click();
  const clues = await page.getByTestId("clue").allInnerTexts();
  await page.getByTestId("close-notebook").click();
  return {
    month: await page.getByTestId("month").innerText(),
    actions: await page.getByTestId("actions-left").innerText(),
    real: await page.getByTestId("card-real").innerText(),
    reported: await page.getByTestId("card-reported").innerText(),
    step: await page.locator(".panel").innerText(),
    clues,
  };
}

test("a later-month start is where the browser helpers would have got to", async ({
  page,
}) => {
  await page.goto("/?seed=2");
  for (let month = 1; month <= 2; month++) {
    await answerAnyNotification(page);
    await attendAndFinishMonth(page);
  }
  const walked = await whereTheRunIs(page);

  await page.goto("/?seed=2&month=3");

  expect(await whereTheRunIs(page)).toEqual(walked);
});

// `npm run play` is the dev server. tests/engine/later-month.test.ts covers the
// production build. A cache of its own, so as not to race broken-content.spec.ts.
test("the dev server ignores a later month", async ({ page }) => {
  const { server, origin } = await startDevServer({
    cacheDir: "node_modules/.vite-later-month",
  });
  try {
    await page.goto(`${origin}?seed=2&month=6`);

    await expect(page.getByTestId("month")).toContainText("1 of 9");
    await expect(page.getByTestId("panel-notification")).toBeVisible();
  } finally {
    await server.close();
  }
});
