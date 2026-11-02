import { expect, test } from "@playwright/test";
import { answerAnyNotification, attendAndFinishMonth, playUntil } from "./play";

// On this seed the desk move of month 4 goes unnoticed at the time, and comes back
// in month 6. Leaving the training undone in month 2 is what the committee then
// calls out. The start makes both choices.
// The results screen is checked by "a Thread > traces back to what started it on
// the results screen" in tests/engine/threads.test.ts.
test("the desk with no window comes back as a Bill in a later month", async ({
  page,
}) => {
  await page.goto(
    "/?seed=2&month=5&choose=skip-training,no-window-coordinator",
  );

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
  await expect(
    page.getByTestId("gauge-card-teflon").getByTestId("gauge-move").last(),
  ).toContainText("desk with no window");
  await page.getByTestId("close-gauges").click();
});
