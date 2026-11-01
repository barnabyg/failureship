import { expect, type Page } from "@playwright/test";

/** Presses Continue, or takes a spare action, until the next month opens. */
export async function finishMonth(page: Page) {
  const month = page.getByTestId("month");
  const results = page.getByTestId("panel-results");
  const before = await month.innerText();
  while ((await month.innerText()) === before && !(await results.isVisible())) {
    const carryOn = page.getByTestId("continue");
    const spare = page.getByTestId("hotspot-work");
    await expect(carryOn.or(spare).or(results).first()).toBeVisible();
    if (await carryOn.isVisible()) await carryOn.click();
    else if (await spare.isEnabled()) await spare.click();
  }
}

/** Answers the month's Notifications, filing the report and saying no to the rest. */
export async function answerAnyNotification(page: Page) {
  const panel = page.getByTestId("panel-notification");
  const told = page.getByTestId("panel-notice");
  await expect(panel.or(told).first()).toBeVisible();
  if (await told.isVisible()) await page.getByTestId("continue").click();
  while (await panel.isVisible()) {
    const report = page.getByTestId("option-report");
    const free = panel.locator("button:enabled", { hasText: "Costs nothing" });
    await ((await report.isVisible()) ? report : free.first()).click();
    await page.getByTestId("continue").click();
  }
  // A Project flagged red has to be explained before anything else.
  const review = page.getByTestId("panel-scene");
  if (await review.isVisible()) {
    await page.locator('[data-testid^="scene-option-"]').first().click();
    await page.getByTestId("continue").click();
  }
}

/** Declines the month's offers and leaves the report unfiled, to keep the actions. */
export async function skipTheReport(page: Page) {
  await page.getByTestId("option-skip").click();
  await page.getByTestId("continue").click();
}

/** Goes to whatever is on in the meeting room this month. */
export async function openMeeting(page: Page) {
  await page.locator('[data-testid^="hotspot-meeting"]:enabled').click();
  await expect(page.getByTestId("panel-scene")).toBeVisible();
}

/** Goes to the meeting, so that nothing follows from missing it, and ends the month. */
export async function attendAndFinishMonth(page: Page) {
  await openMeeting(page);
  await page.locator('[data-testid^="scene-option-"]').first().click();
  await finishMonth(page);
}

/** Plays out whatever is left of the run, without doing anything in particular. */
export async function playToResults(page: Page) {
  const results = page.getByTestId("panel-results");
  while (!(await results.isVisible())) {
    const notification = page.getByTestId("panel-notification");
    if (await notification.isVisible()) await answerAnyNotification(page);
    await finishMonth(page);
  }
}

/** Asks whoever is at the photocopier about the first person on the list. */
export async function askAtPhotocopier(page: Page) {
  await page.getByTestId("hotspot-ask-around").click();
  await page.locator('[data-testid^="subject-"]').first().click();
  await expect(page.getByTestId("panel-claim")).toBeVisible();
}
