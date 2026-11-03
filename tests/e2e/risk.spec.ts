import { expect, test } from "@playwright/test";
import {
  answerAnyNotification,
  continueUntil,
  openMeeting,
  playUntil,
} from "./play";

// On this seed the Office Co-ordinator acts on a Demand faked in month 2, in month 4.
// The start does the training and fakes the Demand.
const faked = "/?seed=2&choose=do-training,fake&month=";

test("a hidden risk lands on the player", async ({ page }) => {
  await page.goto(`${faked}4`);
  await expect(page.getByTestId("month")).toContainText("4 of 9");
  await expect(page.locator("main")).not.toContainText("correction");
  await answerAnyNotification(page);
  await openMeeting(page);
  await page.locator('[data-testid^="scene-option-"]').first().click();

  const landed = page
    .getByTestId("panel-move")
    .filter({ hasText: "correction to the minutes" });
  await continueUntil(page, landed);

  await page.getByTestId("continue").click();
  await expect(page.getByTestId("final-warning")).toBeVisible();
});

// #50 asks to see the risk on the results screen here.
test("a hidden risk that landed is on the results screen", async ({ page }) => {
  await page.goto(`${faked}9`);
  await expect(page.getByTestId("final-warning")).toBeVisible();

  await playUntil(page, "panel-results");
  await expect(page.getByTestId("results-risks")).toContainText(
    "your email attached",
  );
  await expect(
    page
      .getByTestId("result-mistake")
      .filter({ hasText: "correction to the minutes" }),
  ).toHaveCount(1);
});
