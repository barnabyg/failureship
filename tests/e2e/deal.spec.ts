import { expect, test } from "@playwright/test";
import { playUntil } from "./play";

// tests/engine/deals.test.ts keeps these deals true. On seed 2 the Project
// Co-ordinator really has sway with your boss, and on seed 3 they do not.
for (const [seed, worth] of [
  [2, "real sway"],
  [3, "no sway"],
] as const) {
  test(`a good word for a move, on seed ${String(seed)}`, async ({ page }) => {
    await page.goto(`/?seed=${String(seed)}&month=3`);
    await playUntil(page, "scene-option-deal-with-the-coordinator");
    await page.getByTestId("scene-option-deal-with-the-coordinator").click();
    await expect(page.getByTestId("panel-notice")).toContainText(
      "shakes on it",
    );
    await page.getByTestId("continue").click();
    await page.getByTestId("open-word").click();
    await expect(page.getByTestId("word-deal")).toContainText(
      "A move, for a good word",
    );
    await page.getByTestId("close-word").click();

    await playUntil(page, "panel-results");
    await expect(page.getByTestId("result-deal")).toContainText(worth);
  });
}
