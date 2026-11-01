import { expect, test } from "@playwright/test";
import { answerAnyNotification, finishMonth } from "./play";

test("a skipped meeting comes back as a Demand in a later month", async ({
  page,
}) => {
  await page.goto("/?seed=2");
  await answerAnyNotification(page);

  // Stays away from the meeting, and spends the rest elsewhere.
  await page.getByTestId("hotspot-kitchen").click();
  await page.getByTestId("continue").click();
  await page.getByTestId("hotspot-work").click();
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("panel-notice")).toContainText("minutes");
  await expect(page.getByTestId("open-demands")).toContainText("1");
  await expect(page.getByTestId("panel-scene")).toHaveCount(0);
  await finishMonth(page);

  await expect(page.getByTestId("month")).toContainText("2 of");
  const demand = page
    .getByTestId("panel-notification")
    .filter({ hasText: "ACTION:" });
  while (!(await demand.isVisible())) {
    await page
      .getByTestId("panel-notification")
      .locator("button:enabled", { hasText: "Costs nothing" })
      .first()
      .click();
    await page.getByTestId("continue").click();
  }

  await expect(page.getByTestId("option-deliver")).toBeVisible();
  await expect(page.getByTestId("option-push-back")).toBeVisible();
  await expect(page.getByTestId("option-hand-off")).toBeVisible();
  await expect(page.getByTestId("option-fake")).toBeVisible();
  await page.getByTestId("option-stall").click();
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("open-demands")).toContainText("1");
});

test("a meeting you go to leaves no Demand behind", async ({ page }) => {
  await page.goto("/?seed=2");
  await answerAnyNotification(page);
  await page.locator('[data-testid^="hotspot-meeting"]:enabled').click();
  await page.locator('[data-testid^="scene-option-"]').first().click();
  await finishMonth(page);

  await expect(page.getByTestId("month")).toContainText("2 of");
  await expect(page.getByTestId("open-demands")).toHaveCount(0);
});
