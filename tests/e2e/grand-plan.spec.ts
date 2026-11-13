import { expect, test } from "@playwright/test";
import {
  answered,
  freshRun,
  openInboxIfAny,
  openMeeting,
  playUntil,
  readResult,
} from "./play";

// "the Grand Plan browser test's seed" in tests/engine/real-grand-plans.test.ts
// keeps this true: on seed 1, the Plan is heard of at month 1's meeting, and the
// month-4 Demand can fake it.
test("hear of your boss's Grand Plan, and complete it", async ({ page }) => {
  await freshRun(page, "/?seed=1");
  const card = page.getByTestId("grand-plan-card");
  await expect(card).toHaveCount(0);

  await playUntil(page, "hotspot-meeting");
  await openMeeting(page);

  await expect(page.getByTestId("panel-scene")).toContainText(
    "item two is your boss's Grand Plan",
  );
  await expect(card).toHaveAttribute("title", /One tool for everything/);
  await expect(card).toContainText("To be done by the end of month 6");

  await freshRun(page, "/?seed=1&month=4");
  await expect(card).toHaveAttribute("title", /One tool for everything/);
  await playUntil(page, "option-fake");
  await openInboxIfAny(page);
  await page.getByTestId("option-fake").click();
  await expect(answered(page)).toContainText("This solves ALL your problems");
  await readResult(page);

  const told = page.getByTestId("panel-notice");
  await expect(told).toContainText("Your boss's Grand Plan: done");
  await expect(card).toContainText("Completed");
  await page.getByTestId("continue").click();

  await page.getByTestId("open-project").click();
  await expect(page.getByTestId("grand-plan-status")).toHaveText("Completed");
  await expect(page.getByTestId("grand-plan")).toContainText(
    "single new tool for the whole floor",
  );
});
