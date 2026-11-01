import { expect, test, type Page } from "@playwright/test";
import { answerAnyNotification, openMeeting, playToResults } from "./play";

async function readOrgChart(page: Page) {
  await page.getByTestId("open-org-chart").click();
  const chart = await page.getByTestId("org-chart").innerText();
  await page.getByTestId("close-org-chart").click();
  return chart;
}

// On this seed the reorganisation lands in month 3, after a clue in month 2.
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

  const event = page.getByTestId("panel-event");
  const carryOn = page.getByTestId("continue");
  const spare = page.getByTestId("hotspot-work");
  await expect(async () => {
    if (await carryOn.isVisible()) await carryOn.click();
    else if (await spare.isEnabled()) await spare.click();
    await expect(event).toBeVisible({ timeout: 100 });
  }).toPass();

  await expect(event).toContainText("Simplifying how we work");
  await expect(page.getByTestId("month")).toContainText("3 of 9");
  await carryOn.click();
  expect(await readOrgChart(page)).not.toBe(before);

  const story = page.getByTestId("panel-story");
  await expect(async () => {
    if (await carryOn.isVisible()) await carryOn.click();
    await expect(story).toBeVisible({ timeout: 100 });
  }).toPass();
  await expect(story).toContainText("simplified");

  await playToResults(page);

  await expect(page.getByTestId("results-changes")).toContainText(
    "reorganisation",
  );
});
