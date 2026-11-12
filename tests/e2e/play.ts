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

/** Taking it, the last way out of a consequence, as src/ui/later-month.ts does. */
function takeIt(page: Page): Locator {
  return page
    .locator('[data-testid="panel-escape"] [data-testid^="escape-"]')
    .last();
}

/**
 * A panel that waits for an answer before anything else can be done, with the
 * floor dimmed behind it. The inbox, and the card of what just happened, never wait.
 */
export function blockingPanel(page: Page): Locator {
  return page.locator("section.panel:not(.panel-result):not(.panel-inbox)");
}

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
  const unanswered = toAnswer(page);
  const escape = takeIt(page);
  const before = await month.innerText();
  while ((await month.innerText()) === before && !(await results.isVisible())) {
    const carryOn = page.getByTestId("continue");
    const spare = page.locator(DESK);
    await expect(
      carryOn.or(spare).or(results).or(stepOut).or(escape).first(),
    ).toBeVisible();
    if (await stepOut.isVisible()) await stepOut.click();
    else if (await escape.isVisible()) await escape.click();
    else if (
      (await notification.isVisible()) ||
      (await unanswered.first().isVisible())
    ) {
      await answerAnyNotification(page);
    } else if (await carryOn.isVisible()) await carryOn.click();
    else if (await spare.isEnabled()) await spare.click();
  }
}

/** Presses Continue, answers the inbox, or takes a spare action, until the panel shows. */
export async function continueUntil(page: Page, panel: Locator) {
  const carryOn = page.getByTestId("continue");
  const spare = page.locator(DESK);
  const escape = takeIt(page);
  const unanswered = toAnswer(page);
  await expect(async () => {
    if (await panel.isVisible()) return;
    if (await escape.isVisible()) await escape.click();
    else if (await carryOn.isVisible()) await carryOn.click();
    else if (await unanswered.first().isVisible()) {
      await answerAnyNotification(page);
    } else if (await spare.isEnabled()) await spare.click();
    await expect(panel).toBeVisible({ timeout: 100 });
  }).toPass();
}

/** What in the inbox is still to be answered, in its list. */
function toAnswer(page: Page): Locator {
  return page.locator('[data-testid="inbox-item"][data-to-answer="true"]');
}

/**
 * Opens the inbox at the top, if it is closed, so that whatever is to answer
 * there shows: an e-mail, or a consequence with its ways out.
 */
export async function openInbox(page: Page) {
  const open = page
    .getByTestId("panel-notification")
    .or(page.getByTestId("panel-escape"));
  await expect(open.or(toAnswer(page)).first()).toBeVisible();
  if (!(await open.first().isVisible())) await toAnswer(page).first().click();
  await expect(open.first()).toBeVisible();
}

/**
 * Opens the inbox, as `openInbox` does, if there is anything in it to answer
 * once the page has settled, and otherwise leaves the page as it is.
 */
export async function openInboxIfAny(page: Page) {
  const open = page
    .getByTestId("panel-notification")
    .or(page.getByTestId("panel-escape"));
  try {
    await expect(open.or(toAnswer(page)).first()).toBeVisible({
      timeout: 3000,
    });
  } catch {
    return;
  }
  await openInbox(page);
}

/** Answers the month's inbox, filing the report and saying no to the rest. */
export async function answerAnyNotification(page: Page) {
  const panel = page.getByTestId("panel-notification");
  const told = page.getByTestId("panel-notice");
  const escape = takeIt(page);
  const unanswered = toAnswer(page);
  await expect(panel.or(told).or(escape).or(unanswered).first()).toBeVisible();
  if (await told.isVisible()) await page.getByTestId("continue").click();
  for (;;) {
    if (await escape.isVisible()) await escape.click();
    else if (await panel.isVisible()) await answerNotification(page);
    else if (await unanswered.first().isVisible()) {
      await unanswered.first().click();
    } else break;
  }
  // A Project flagged red has to be explained before anything else.
  const review = page.getByTestId("panel-scene");
  if (await review.isVisible()) {
    await page.locator('[data-testid^="scene-option-"]').first().click();
  }
}

/**
 * Files the report, or says no, to the Notification open in the inbox, opening
 * the inbox if it is closed, and waits for it to go. Its result stays over the
 * next one, which opens in its place, at no extra click.
 */
export async function answerNotification(page: Page) {
  const panel = page.getByTestId("panel-notification");
  if (!(await panel.isVisible())) await openInbox(page);
  const subject = await panel.locator("h2").innerText();
  const report = page.getByTestId("option-report");
  const free = panel.locator('[data-testid^="option-"]:enabled', {
    hasText: "Costs nothing",
  });
  await ((await report.isVisible()) ? report : free.first()).click();
  await expect(panel.locator("h2", { hasText: subject })).toHaveCount(0);
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
  const escape = takeIt(page);
  const unanswered = toAnswer(page);
  for (;;) {
    await expect(
      wanted
        .or(escape)
        .or(notification)
        .or(unanswered)
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
    } else if (await escape.isVisible()) {
      await escape.click();
    } else if (await notification.isVisible()) {
      await answerNotification(page);
    } else if (await unanswered.first().isVisible()) {
      await unanswered.first().click();
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
  await openInbox(page);
  await page.getByTestId("option-skip").click();
  await expect(page.getByTestId("option-skip")).toHaveCount(0);
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
  await expect(claimHeard(page)).toBeVisible();
}

/** What the player was told at Find Out, which stays until they do something else. */
export function claimHeard(page: Page): Locator {
  return page.locator('[data-testid="result"][data-kind="claim"]');
}

/** What came of the player's last action on the floor, or in a Scene. */
export function happened(page: Page): Locator {
  return page.locator('[data-testid="result"][data-kind="happened"]');
}

/** A Notification answered, with what came of it, under the answer. */
export function answered(page: Page): Locator {
  return page.getByTestId("answered");
}
