import { expect, test } from "@playwright/test";
import {
  answerAnyNotification,
  happened,
  openMeeting,
  playUntil,
} from "./play";

// tests/engine/real-content.test.ts keeps this seed true: the Office Co-ordinator
// acts on a Demand faked in month 2, in month 4, and it lands on the player
// with ways out of it.
// The start does the training and fakes the Demand.
const faked = "/?seed=13&choose=do-training,fake&month=";

test("a hidden risk lands on the player, with ways out of it", async ({
  page,
}) => {
  await page.goto(`${faked}4`);
  await expect(page.getByTestId("month")).toContainText("4 of 18");
  await expect(page.locator("main")).not.toContainText("correction");
  await answerAnyNotification(page);
  await openMeeting(page);
  await page.locator('[data-testid^="scene-option-"]').first().click();

  await playUntil(page, "escape-correction-take-it");
  await expect(page.getByTestId("panel-escape")).toContainText(
    "A correction to the minutes",
  );
  await expect(
    page.getByTestId("escape-correction-blame-the-associate"),
  ).toBeVisible();
  await page.getByTestId("escape-correction-take-it").click();
  await expect(happened(page)).toContainText("accepts your thanks");
});

// #50 asks to see the risk on the results screen here.
test("a hidden risk that landed is on the results screen", async ({ page }) => {
  await page.goto(`${faked}9&last=9`);

  await playUntil(page, "panel-results");
  await expect(page.getByTestId("results-risks")).toContainText(
    "your email attached",
  );
});
