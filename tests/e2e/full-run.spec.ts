import { expect, test, type Page } from "@playwright/test";
import {
  answerAnyNotification,
  finishMonth,
  freshRun,
  openInboxIfAny,
  openMeeting,
  playUntil,
} from "./play";

// Over 10 s, as walking every month in the browser is what it is for, and
// eighteen of them take longer than the usual limit.
test("eighteen months, all the way to the results screen", async ({ page }) => {
  test.slow();
  await page.goto("/?seed=8");
  const scenes = new Set<string>();
  const notifications = new Set<string>();

  for (let month = 1; month <= 18; month++) {
    await expect(page.getByTestId("month")).toContainText(
      `${String(month)} of 18`,
    );
    await expect(page.getByTestId("hint")).not.toBeEmpty();
    // Part-way through, a reload carries on from the same step.
    if (month === 5) {
      await page.reload();
      await expect(page.getByTestId("month")).toContainText("5 of 18");
    }
    await expect(page.getByTestId("gauge-teflon")).toBeVisible();
    await expect(page.getByTestId("gauge-fawning")).toBeVisible();
    await openInboxIfAny(page);
    notifications.add(
      await page.getByTestId("panel-notification").locator("h2").innerText(),
    );
    await answerAnyNotification(page);
    await expect(page.getByTestId("hint")).not.toBeEmpty();

    await openMeeting(page);
    const panel = page.getByTestId("panel-scene");
    await expect(panel).not.toContainText(/\{\w+\}/);
    scenes.add(await panel.locator("h2").innerText());
    await page.locator('[data-testid^="scene-option-"]').first().click();

    await finishMonth(page);
  }

  // Nine written months, and then Floor 1's pool of six, each in turn.
  expect(scenes.size).toBe(15);
  expect(notifications.size).toBe(15);
  await expect(page.getByTestId("panel-results")).toBeVisible();
  await expect(page.getByTestId("result-family")).toHaveCount(7);
  // Floor 2's cast is never met on Floor 1, so the results leave them out.
  await expect(page.getByTestId("result-character")).toHaveCount(6);
  await expect(page.getByTestId("results-org-chart")).toContainText(
    "Hugh Lamb",
  );
  await expect(page.getByTestId("results-power-map")).toContainText(
    "Hugh Lamb",
  );
  await expect(page.getByTestId("panel-results")).toContainText(
    /Believer|Incompetent|Practitioner/,
  );
  await expect(page.getByTestId("result-mark")).toHaveCount(6);
  await page.getByTestId("results-section-clues").locator("summary").click();
  await expect(page.getByTestId("result-clue").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/placeholder|lorem/i);
});

/** Plays on as the plain player until the option is offered, and takes it. */
async function take(page: Page, option: string) {
  await playUntil(page, `scene-option-${option}`);
  await page.getByTestId(`scene-option-${option}`).click();
}

/** Plays on until an e-mail offers this answer, and gives it. */
async function answer(page: Page, option: string) {
  await playUntil(page, `option-${option}`);
  await page.getByTestId(`option-${option}`).click();
}

// The climb from the very start, as a player would see it, with a reload on
// Floor 2. tests/engine/browser-seeds.test.ts keeps seed 2 true for win.spec.ts,
// which takes the same choices from month 11.
test("from month 1 all the way to the win, reloaded part-way up", async ({
  page,
}) => {
  test.slow();
  await freshRun(page, "/?seed=2");
  await expect(page.getByTestId("goal")).toBeVisible();

  await take(page, "take-the-blame");
  await take(page, "screenshot-on-the-note");
  await answer(page, "claim-the-credit");
  await answer(page, "word-with-the-analyst");
  await playUntil(page, "decided");
  await expect(page.getByTestId("panel-notice")).toContainText(
    "Congratulations: Team lead",
  );
  await take(page, "sign-on-a-door");
  await expect(page.getByTestId("job-title")).toHaveText("Team lead");

  await page.reload();
  await expect(page.getByTestId("job-title")).toHaveText("Team lead");
  await expect(page.getByTestId("month")).toContainText("9 of 18");

  await answer(page, "word-with-the-coordinator-2");
  await take(page, "draw-swimlanes");
  await expect(page.getByTestId("job-title")).toHaveText("Middle manager");
  await answer(page, "claim-it-middle-manager");
  await playUntil(page, "panel-win");
  await expect(page.getByTestId("month")).toContainText("15 of 18");
  await expect(page.getByTestId("hint")).not.toBeEmpty();
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("results-ending")).toContainText("in month 15");
  await expect(page.getByTestId("result-route")).toHaveCount(3);
  await expect(page.locator("body")).not.toContainText(/\{\w+\}/);
  await expect(page.locator("body")).not.toContainText(/placeholder|lorem/i);
});
