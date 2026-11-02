import { expect, test } from "@playwright/test";
import {
  answerAnyNotification,
  attendAndFinishMonth,
  playToResults,
  playUntil,
} from "./play";

// On this seed the desk move goes unnoticed at the time, and comes back in month 6.
// Leaving the training undone in month 2 is what the committee then calls out.
test("the desk with no window comes back as a Bill in a later month", async ({
  page,
}) => {
  await page.goto("/?seed=2");
  await answerAnyNotification(page);
  await attendAndFinishMonth(page);
  await page.getByTestId("option-skip-training").click();
  await page.getByTestId("continue").click();
  await answerAnyNotification(page);
  await attendAndFinishMonth(page);
  await answerAnyNotification(page);
  await attendAndFinishMonth(page);

  await expect(page.getByTestId("month")).toContainText("4 of 9");
  await page.getByTestId("option-no-window-coordinator").click();
  await page.getByTestId("continue").click();
  await answerAnyNotification(page);
  await attendAndFinishMonth(page);

  // Month 5 passes with no word of it.
  await expect(page.getByTestId("month")).toContainText("5 of 9");
  await expect(page.locator(".panel")).not.toContainText("Health and Safety");
  await answerAnyNotification(page);
  await attendAndFinishMonth(page);

  await expect(page.getByTestId("month")).toContainText("6 of 9");
  await expect(page.getByTestId("panel-notification")).toContainText(
    "Health and Safety",
  );
  const teflon = page.getByTestId("gauge-teflon").locator("dd");
  const before = Number(await teflon.innerText());
  await page.getByTestId("option-say-it-was-scheduled").click();
  await page.getByTestId("continue").click();

  // Teflon moves as the month closes, and says which Thread moved it.
  await playUntil(page, "panel-story");
  await expect(page.getByTestId("story-gauge")).toContainText(
    "desk with no window",
  );
  await expect(teflon).toHaveText(String(before - 10));
  await page.getByTestId("open-gauge-teflon").click();
  await expect(page.getByTestId("gauge-move").last()).toContainText(
    "desk with no window",
  );
  await page.getByTestId("close-gauges").click();

  await playToResults(page);

  await expect(
    page
      .getByTestId("result-thread")
      .filter({ hasText: "desk with no window" }),
  ).toBeVisible();
});
