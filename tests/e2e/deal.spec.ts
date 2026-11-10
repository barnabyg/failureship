import { expect, test } from "@playwright/test";
import { happened, playUntil } from "./play";

test("a good word for a move is shaken on, and kept in Your word given", async ({
  page,
}) => {
  await page.goto("/?seed=2&month=3");
  await playUntil(page, "scene-option-deal-with-the-coordinator");
  await page.getByTestId("scene-option-deal-with-the-coordinator").click();
  await expect(happened(page)).toContainText("shakes on it");
  await page.getByTestId("open-word").click();
  await expect(page.getByTestId("word-deal")).toContainText(
    "A move, for a good word",
  );
  await page.getByTestId("close-word").click();
});

// tests/engine/deals.test.ts keeps these deals true. On seed 10 the Project
// Co-ordinator really has sway with your boss, and on seed 3 they do not. The start
// makes the deal in month 3, as the test above does, since what it was worth shows
// only on the results screen.
for (const [seed, worth] of [
  [10, "real sway"],
  [3, "no sway"],
] as const) {
  test(`what a good word was worth, on seed ${String(seed)}`, async ({
    page,
  }) => {
    await page.goto(
      `/?seed=${String(seed)}&month=9&last=9&choose=deal-with-the-coordinator`,
    );
    await playUntil(page, "panel-results");
    await expect(page.getByTestId("result-deal")).toContainText(worth);
  });
}
