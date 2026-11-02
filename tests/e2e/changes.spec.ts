import { expect, test } from "@playwright/test";
import { playUntil } from "./play";

// tests/engine/changes.test.ts keeps this seed true: the Senior Analyst is a
// Believer, and blamed and then let down, starts keeping a file on you.
test("a Believer burned twice changes, and only the results screen says so", async ({
  page,
}) => {
  await page.goto("/?seed=32&month=2");
  await playUntil(page, "scene-option-blame-priya");
  await page.getByTestId("scene-option-blame-priya").click();
  await page.getByTestId("continue").click();
  await playUntil(page, "option-promise-laptops-analyst");
  await page.getByTestId("option-promise-laptops-analyst").click();
  await page.getByTestId("continue").click();
  await playUntil(page, "option-next-quarter");
  await page.getByTestId("option-next-quarter").click();
  await page.getByTestId("continue").click();
  await expect(page.locator("body")).not.toContainText("whistleblower");

  await playUntil(page, "panel-results");
  const changed = page.getByTestId("result-changed");
  await expect(changed).toHaveCount(1);
  await expect(changed).toContainText("Senior Analyst");
  await expect(changed).toContainText("whistleblower");
  await expect(changed).toContainText("Lessons Learned Review");
});
