import { expect, test } from "@playwright/test";
import { answerAnyNotification, finishMonth, openMeeting } from "./play";

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
    notifications.add(await page.getByTestId("panel-notification").innerText());
    await answerAnyNotification(page);
    await expect(page.getByTestId("hint")).not.toBeEmpty();

    await openMeeting(page);
    const panel = page.getByTestId("panel-scene");
    await expect(panel).not.toContainText(/\{\w+\}/);
    scenes.add(await panel.locator("h2").innerText());
    await page.locator('[data-testid^="scene-option-"]').first().click();

    await finishMonth(page);
  }

  // Nine written months, and then Floor 1's pool of three, each in turn.
  expect(scenes.size).toBe(12);
  expect(notifications.size).toBe(12);
  await expect(page.getByTestId("panel-results")).toBeVisible();
  await expect(page.getByTestId("result-family")).toHaveCount(7);
  await expect(page.getByTestId("result-character")).toHaveCount(8);
  await expect(page.getByTestId("results-org-chart")).toContainText(
    "Hugh Lamb",
  );
  await expect(page.getByTestId("results-power-map")).toContainText(
    "Hugh Lamb",
  );
  await expect(page.getByTestId("panel-results")).toContainText(
    /Believer|Incompetent|Practitioner/,
  );
  await expect(page.getByTestId("result-mark")).toHaveCount(8);
  await expect(page.getByTestId("result-clue").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/placeholder|lorem/i);
});
