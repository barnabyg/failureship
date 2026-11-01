import { expect, type Page } from "@playwright/test";

/** Presses Continue, or takes a spare action, until the next month opens. */
export async function finishMonth(page: Page) {
  const month = page.getByTestId("month");
  const before = await month.innerText();
  while ((await month.innerText()) === before) {
    const carryOn = page.getByTestId("continue");
    const spare = page.getByTestId("hotspot-work");
    await expect(carryOn.or(spare).first()).toBeVisible();
    if (await carryOn.isVisible()) await carryOn.click();
    else await spare.click();
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
