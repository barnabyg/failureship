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

/** Answers the Notification with its first option. */
export async function answerAnyNotification(page: Page) {
  await page.locator('[data-testid^="option-"]:enabled').first().click();
  await page.getByTestId("continue").click();
}

/** Goes to whatever is on in the meeting room this month. */
export async function openMeeting(page: Page) {
  await page.locator('[data-testid^="hotspot-meeting"]:enabled').click();
  await expect(page.getByTestId("panel-scene")).toBeVisible();
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
