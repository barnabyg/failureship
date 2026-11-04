import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Walking on to the results screen plays out the rest of an 18-month run, which
 * takes CI most of a minute, so a test that does it gets the slow test's time,
 * unless `&last=N` in the address ends the run early.
 */
function walkingToTheEnd(page: Page) {
  if (!new URL(page.url()).searchParams.has("last")) test.slow();
}

/** The player's own desk, on whichever floor they are, by its action in actions.json. */
const DESKS = ["work", "work-2", "work-3"];
const DESK = DESKS.map((id) => `[data-testid="hotspot-${id}"]`).join(", ");

/** Goes to an address as a new player would, with no saved run to come back to. */
export async function freshRun(page: Page, address: string) {
  if (page.url() !== "about:blank") {
    await page.evaluate(() => {
      window.localStorage.clear();
    });
  }
  await page.goto(address);
}

/**
 * Presses Continue, or takes a spare action, until the next month opens. A seat
 * won or lost to a mistake on the way rides the lift, and steps out of it, and
 * the new floor's Notifications are answered as `answerAnyNotification` does.
 */
export async function finishMonth(page: Page) {
  const month = page.getByTestId("month");
  const results = page.getByTestId("panel-results");
  const stepOut = page.getByTestId("lift-step-out");
  const notification = page.getByTestId("panel-notification");
  const before = await month.innerText();
  while ((await month.innerText()) === before && !(await results.isVisible())) {
    const carryOn = page.getByTestId("continue");
    const spare = page.locator(DESK);
    await expect(
      carryOn.or(spare).or(results).or(stepOut).first(),
    ).toBeVisible();
    if (await stepOut.isVisible()) await stepOut.click();
    else if (await notification.isVisible()) await answerAnyNotification(page);
    else if (await carryOn.isVisible()) await carryOn.click();
    else if (await spare.isEnabled()) await spare.click();
  }
}

/** Presses Continue, or takes a spare action, until the panel shows. */
export async function continueUntil(page: Page, panel: Locator) {
  const carryOn = page.getByTestId("continue");
  const spare = page.locator(DESK);
  await expect(async () => {
    if (await carryOn.isVisible()) await carryOn.click();
    else if (await spare.isEnabled()) await spare.click();
    await expect(panel).toBeVisible({ timeout: 100 });
  }).toPass();
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

/**
 * Plays as src/ui/later-month.ts does, so a seed kept true by an engine test holds:
 * files the report, says no to the rest, goes to the meeting and then to the desk,
 * until the wanted thing can be pressed.
 */
export async function playUntil(page: Page, testId: string) {
  if (testId === "panel-results") walkingToTheEnd(page);
  const wanted = page.getByTestId(testId);
  const notification = page.getByTestId("panel-notification");
  const scene = page.getByTestId("panel-scene");
  const carryOn = page.getByTestId("continue");
  const meeting = page.locator('[data-testid^="hotspot-meeting"]:enabled');
  const desk = page.locator(
    DESKS.map((id) => `[data-testid="hotspot-${id}"]:enabled`).join(", "),
  );
  const stepOut = page.getByTestId("lift-step-out");
  for (;;) {
    await expect(
      wanted
        .or(notification)
        .or(scene)
        .or(carryOn)
        .or(meeting)
        .or(desk)
        .or(stepOut)
        .first(),
    ).toBeVisible();
    if ((await wanted.isVisible()) && (await wanted.isEnabled())) return;
    if (await stepOut.isVisible()) {
      await stepOut.click();
    } else if (await notification.isVisible()) {
      const report = page.getByTestId("option-report");
      const free = notification.locator("button:enabled", {
        hasText: "Costs nothing",
      });
      await ((await report.isVisible()) ? report : free.first()).click();
    } else if (await scene.isVisible()) {
      await page.locator('[data-testid^="scene-option-"]').first().click();
    } else if (await carryOn.isVisible()) {
      await carryOn.click();
    } else if (await meeting.isVisible()) {
      await meeting.click();
    } else {
      await desk.click();
    }
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
  walkingToTheEnd(page);
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
