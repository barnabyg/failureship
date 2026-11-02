import { expect, test } from "@playwright/test";
import { playUntil } from "./play";

// tests/engine/changes.test.ts keeps this seed true: the Senior Analyst is a
// Believer, and blamed in month 2 and let down over the laptops, changes in month 6.
// The start makes those choices, as promise.spec.ts already plays the laptops.
test("a Believer burned twice changes, and only the results screen says so", async ({
  page,
}) => {
  await page.goto(
    "/?seed=32&month=9&choose=blame-priya,promise-laptops-analyst,next-quarter",
  );
  await expect(page.locator("body")).not.toContainText("whistleblower");

  await playUntil(page, "panel-results");
  const changed = page.getByTestId("result-changed");
  await expect(changed).toHaveCount(1);
  await expect(changed).toContainText("Senior Analyst");
  await expect(changed).toContainText("whistleblower");
  await expect(changed).toContainText("Lessons Learned Review");
});
