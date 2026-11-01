import { expect, test } from "@playwright/test";
import { answerAnyNotification, finishMonth, openMeeting } from "./play";

test("nine different months, all the way to the results screen", async ({
  page,
}) => {
  await page.goto("/?seed=8");
  const scenes = new Set<string>();
  const notifications = new Set<string>();

  for (let month = 1; month <= 9; month++) {
    await expect(page.getByTestId("month")).toContainText(
      `${String(month)} of 9`,
    );
    await expect(page.getByTestId("hint")).not.toBeEmpty();
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

  expect(scenes.size).toBe(9);
  expect(notifications.size).toBe(9);
  await expect(page.getByTestId("panel-results")).toBeVisible();
  await expect(page.getByTestId("result-family")).toHaveCount(7);
  await expect(page.getByTestId("result-character")).toHaveCount(5);
  await expect(page.getByTestId("result-mark")).toHaveCount(5);
  await expect(page.getByTestId("result-clue").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/placeholder|lorem/i);
});
