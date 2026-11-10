import { expect, test } from "@playwright/test";
import { playToResults, skipTheReport } from "./play";

// "Official standing" in tests/engine/standing.test.ts checks the rules.
test("Official standing moves when the report goes unfiled", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  const bar = page.getByTestId("standing");
  const marker = bar.locator(".standing-marker");
  await expect(bar).toBeVisible();
  // No number, not even to a screen reader: only its band is said.
  await expect(bar).toHaveAccessibleName("Official standing: Amber");
  await expect(bar).not.toHaveAttribute("aria-valuenow");
  await expect(bar).not.toContainText(/\d/);
  const before = await marker.evaluate((m) => m.style.left);

  await page.getByTestId("option-decline").click();
  await expect(marker).toHaveAttribute("style", `left: ${before};`);
  await skipTheReport(page);

  // Unfiled, and reported a colour worse: lower, though still amber.
  await expect(marker).not.toHaveAttribute("style", `left: ${before};`);
  const after = await marker.evaluate((m) => m.style.left);
  expect(parseFloat(after)).toBeLessThan(parseFloat(before));
});

test("the results screen sets Official standing beside who really decides", async ({
  page,
}) => {
  await page.goto("/?seed=1&month=9&last=9");
  await playToResults(page);

  const standing = page.getByTestId("result-standing");
  await expect(standing.getByTestId("result-standing-bar")).toBeVisible();
  await expect(standing).toContainText("On paper");
  await expect(standing).toContainText("in the gift of");
});
