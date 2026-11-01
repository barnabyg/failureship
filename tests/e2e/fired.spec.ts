import { expect, test } from "@playwright/test";
import { answerAnyNotification, finishMonth, openMeeting } from "./play";

test("a catastrophic choice says so first, and ends at the results screen", async ({
  page,
}) => {
  await page.goto("/?seed=1&month=8");
  await answerAnyNotification(page);
  await openMeeting(page);
  const choice = page.getByTestId("scene-option-tell-them-everything");
  await expect(choice.getByTestId("stakes")).toBeVisible();
  await expect(page.getByTestId("final-warning")).toHaveCount(0);

  await choice.click();
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("panel-notice")).toContainText("released");
  await page.getByTestId("continue").click();

  const results = page.getByTestId("panel-results");
  await expect(results).toBeVisible();
  await expect(page.getByTestId("results-ending")).toContainText("fired");
  await expect(page.getByTestId("result-mistake")).toHaveCount(1);
  await expect(page.getByTestId("result-character").first()).toBeVisible();
});

// tests/engine/real-content.test.ts keeps this seed true: the Project Co-ordinator
// has a dangerous Hidden Fact, so blaming and then cutting them are big mistakes.
test("a Final Warning shows, and a second big mistake gets the player fired", async ({
  page,
}) => {
  await page.goto("/?seed=3&month=2");
  await answerAnyNotification(page);
  await page.getByTestId("hotspot-meeting-lessons").click();
  await page.getByTestId("scene-option-blame-callum").click();
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("panel-notice")).toContainText("envelope");
  await expect(page.getByTestId("final-warning")).toBeVisible();
  await finishMonth(page);

  // Month 3, on to month 4 and the Budget Round.
  await answerAnyNotification(page);
  await finishMonth(page);
  await expect(page.getByTestId("final-warning")).toBeVisible();
  await answerAnyNotification(page);
  await openMeeting(page);
  await page.getByTestId("scene-option-cut-callum").click();
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("panel-notice")).toContainText("released");
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("panel-results")).toBeVisible();
  await expect(page.getByTestId("result-mistake")).toHaveCount(2);
});
