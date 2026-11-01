import { expect, test, type Page } from "@playwright/test";
import {
  answerAnyNotification,
  finishMonth,
  freshRun,
  openMeeting,
} from "./play";

/** Month 2's review, with the choice given, and on to month 3's meeting. */
async function reviewThenNextMeeting(page: Page, optionId: string) {
  await answerAnyNotification(page);
  await page.getByTestId("hotspot-meeting-lessons").click();
  await page.getByTestId(`scene-option-${optionId}`).click();
  await finishMonth(page);
  await answerAnyNotification(page);
  await openMeeting(page);
}

// On this seed the Office Co-ordinator is tied to the Senior Analyst, and hears of
// it by month 3, though nobody blamed them and they were told nothing.
test("something public reaches a connected Character, who behaves differently", async ({
  page,
}) => {
  const regard = page
    .getByTestId("regard")
    .filter({ hasText: "Office Co-ordinator" });

  await freshRun(page, "/?seed=16&month=2");
  await reviewThenNextMeeting(page, "blame-supplier");
  const without = await regard.innerText();

  await freshRun(page, "/?seed=16&month=2");
  await reviewThenNextMeeting(page, "blame-priya");
  const after = await regard.innerText();

  expect(after).not.toBe(without);
  expect(after).toMatch(/stops talking|misses you out/);
  await expect(page.locator(".panel")).not.toContainText(
    "heard it from the Senior Analyst",
  );
});
