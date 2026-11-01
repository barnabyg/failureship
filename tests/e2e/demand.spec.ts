import { expect, test, type Page } from "@playwright/test";
import { answerAnyNotification, finishMonth } from "./play";

/** Reaches month 2's Demand from your boss's boss, and stalls it. */
async function stallTheDemand(page: Page, seed: number) {
  await page.goto(`/?seed=${String(seed)}`);
  await answerAnyNotification(page);
  await finishMonth(page);
  await page.getByTestId("option-skip-training").click();
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("panel-notification")).toContainText(
    "Hugh Lamb",
  );
  await expect(page.getByTestId("option-deliver")).toBeVisible();
  await expect(page.getByTestId("option-push-back")).toBeVisible();
  await expect(page.getByTestId("option-hand-off")).toContainText(
    "the Office Co-ordinator",
  );
  await expect(page.getByTestId("option-fake")).toBeVisible();
  await page.getByTestId("option-stall").click();
  await page.getByTestId("continue").click();
}

// The real-content test keeps these seeds true of month 3.
test("a stalled Demand stays open, and a chase follows it into a later month", async ({
  page,
}) => {
  await stallTheDemand(page, 4);
  await expect(page.getByTestId("open-demands")).toContainText("1");
  await answerAnyNotification(page);
  await finishMonth(page);

  await expect(page.getByTestId("month")).toContainText("3 of 6");
  await expect(page.getByTestId("panel-notification")).toContainText(
    "where are we on this",
  );
  await page.getByTestId("open-project").click();
  await expect(page.getByTestId("open-demand")).toContainText("Meetings");
  await page.getByTestId("close-project").click();

  await page.getByTestId("option-do-it-late").click();

  await expect(page.getByTestId("open-demands")).toHaveCount(0);
});

test("a stalled Demand can be forgotten, which closes it", async ({ page }) => {
  await stallTheDemand(page, 8);
  await expect(page.getByTestId("open-demands")).toContainText("1");
  await answerAnyNotification(page);
  await finishMonth(page);

  await expect(page.getByTestId("month")).toContainText("3 of 6");
  await expect(page.getByTestId("panel-notice")).toContainText(
    "not mentioned again",
  );
  await expect(page.getByTestId("open-demands")).toHaveCount(0);
});
