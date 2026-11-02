import { expect, test } from "@playwright/test";
import {
  answerAnyNotification,
  finishMonth,
  openMeeting,
  playUntil,
} from "./play";

// On this seed, handing the arrow to your boss comes back the month after. The plain
// slides keep the animated ones' Thread out of it. "Fawning > ends the same on deals
// with different Power Maps..." in tests/engine/fawning.test.ts checks the rules.
test("handing your boss the credit comes back on Fawning", async ({ page }) => {
  await page.goto("/?seed=1&month=5");
  const fawning = page.getByTestId("gauge-fawning").locator("dd");
  await expect(page.getByTestId("gauge-fawning")).toBeVisible();
  await page.getByTestId("option-plain").click();
  await page.getByTestId("continue").click();
  await answerAnyNotification(page);
  await openMeeting(page);
  await page.getByTestId("scene-option-credit-boss").click();
  await finishMonth(page);

  await expect(page.getByTestId("month")).toContainText("6 of 9");
  const before = Number(await fawning.innerText());
  await answerAnyNotification(page);

  // Fawning moves as the month closes, and says which Thread moved it.
  await playUntil(page, "panel-story");
  await expect(
    page.getByTestId("story-gauge").filter({ hasText: "Fawning" }),
  ).toContainText("Handing the arrow to your boss");
  await expect(fawning).toHaveText(String(before + 15));
  await page.getByTestId("open-gauge-fawning").click();
  await expect(
    page.getByTestId("gauge-card-fawning").getByTestId("gauge-move").last(),
  ).toContainText("Handing the arrow to your boss");
  await page.getByTestId("close-gauges").click();
});
