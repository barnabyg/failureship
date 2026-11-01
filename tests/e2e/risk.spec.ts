import { expect, test } from "@playwright/test";
import {
  answerAnyNotification,
  attendAndFinishMonth,
  openMeeting,
  playToResults,
} from "./play";

// On this seed the Office Co-ordinator acts on a Demand faked in month 2, in month 4.
test("a hidden risk lands on the player, and is on the results screen", async ({
  page,
}) => {
  await page.goto("/?seed=2&month=2");
  await page.getByTestId("option-do-training").click();
  await page.getByTestId("continue").click();
  await page.getByTestId("option-fake").click();
  await page.getByTestId("continue").click();
  await answerAnyNotification(page);
  await attendAndFinishMonth(page);
  await answerAnyNotification(page);
  await attendAndFinishMonth(page);

  await expect(page.getByTestId("month")).toContainText("4 of 9");
  await expect(page.locator("main")).not.toContainText("correction");
  await answerAnyNotification(page);
  await openMeeting(page);
  await page.locator('[data-testid^="scene-option-"]').first().click();

  const landed = page
    .getByTestId("panel-move")
    .filter({ hasText: "correction to the minutes" });
  const carryOn = page.getByTestId("continue");
  const spare = page.getByTestId("hotspot-work");
  await expect(async () => {
    if (await carryOn.isVisible()) await carryOn.click();
    else if (await spare.isEnabled()) await spare.click();
    await expect(landed).toBeVisible({ timeout: 100 });
  }).toPass();

  await carryOn.click();
  await expect(page.getByTestId("final-warning")).toBeVisible();

  await playToResults(page);

  await expect(page.getByTestId("results-risks")).toContainText(
    "your email attached",
  );
  await expect(page.getByTestId("result-mistake")).toContainText(
    "correction to the minutes",
  );
});
