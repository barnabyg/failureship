import { expect, test } from "@playwright/test";
import {
  answerAnyNotification,
  answerNotification,
  finishMonth,
  openInboxIfAny,
  readAnyResult,
  readResult,
} from "./play";

test("a skipped meeting comes back as a Demand in a later month", async ({
  page,
}) => {
  await page.goto("/?seed=2");
  await answerAnyNotification(page);

  // Stays away from the meeting, and spends the rest elsewhere.
  await page.getByTestId("hotspot-kitchen").click();
  await readResult(page);
  await page.getByTestId("hotspot-work").click();
  await readResult(page);

  await expect(
    page.getByTestId("landed").filter({ hasText: "minutes" }).first(),
  ).toHaveAttribute("data-kind", "notice");
  await expect(page.getByTestId("open-demands")).toContainText("1");
  await expect(page.getByTestId("panel-scene")).toHaveCount(0);
  await finishMonth(page);

  await expect(page.getByTestId("month")).toContainText("2 of");
  await openInboxIfAny(page);
  const demand = page
    .getByTestId("panel-notification")
    .filter({ has: page.locator("h2", { hasText: "ACTION:" }) });
  while (!(await demand.isVisible())) {
    await answerNotification(page);
    await readAnyResult(page);
  }

  await expect(page.getByTestId("option-deliver")).toBeVisible();
  await expect(page.getByTestId("option-push-back")).toBeVisible();
  await expect(page.getByTestId("option-hand-off")).toBeVisible();
  await expect(page.getByTestId("option-fake")).toBeVisible();
  await page.getByTestId("option-stall").click();

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
