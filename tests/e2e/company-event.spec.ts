import { expect, test, type Page } from "@playwright/test";
import { answerAnyNotification, continueUntil, openMeeting } from "./play";

async function readOrgChart(page: Page) {
  await page.getByTestId("open-org-chart").click();
  const chart = await page.getByTestId("org-chart").innerText();
  await page.getByTestId("close-org-chart").click();
  return chart;
}

// On this seed the reorganisation lands in month 3, after a clue in month 2.
// The results screen is checked by "a reshuffle > is on the results screen, as the
// charts ended up and what changed them" in tests/engine/company-events.test.ts.
test("a Company Event lands and the Org Chart changes", async ({ page }) => {
  await page.goto("/?seed=3&month=3");
  const before = await readOrgChart(page);
  await page.getByTestId("open-notebook").click();
  await expect(page.getByTestId("notebook")).toContainText("draft org chart");
  await page.getByTestId("close-notebook").click();

  await answerAnyNotification(page);
  await openMeeting(page);
  await page.locator('[data-testid^="scene-option-"]').first().click();
  expect(await readOrgChart(page)).toBe(before);

  // It lands as the month closes, told first in the official story.
  const story = page.getByTestId("panel-story");
  await continueUntil(page, story);
  await expect(story.getByTestId("landed").first()).toHaveAttribute(
    "data-kind",
    "event",
  );
  await expect(story.getByTestId("landed").first()).toContainText(
    "Simplifying how we work",
  );
  await expect(page.getByTestId("month")).toContainText("3 of 18");
  await expect(story).toContainText("simplified");
  expect(await readOrgChart(page)).not.toBe(before);
});
