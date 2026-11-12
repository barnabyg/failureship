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
  // A plain regard, such as a nod hello, is left out of the row.
  const regard = page
    .getByTestId("person")
    .filter({
      has: page.locator("strong", { hasText: /^Office Co-ordinator$/ }),
    })
    .getByTestId("regard");
  const regardNow = async () => (await regard.allInnerTexts()).join("");

  await freshRun(page, "/?seed=29&month=2");
  await reviewThenNextMeeting(page, "blame-supplier");
  const without = await regardNow();

  await freshRun(page, "/?seed=29&month=2");
  await reviewThenNextMeeting(page, "blame-priya");
  const after = await regardNow();

  expect(after).not.toBe(without);
  expect(after).toMatch(/Stops talking|Thanks everyone except you/);
  await expect(page.locator(".panel")).not.toContainText(
    "heard it from the Senior Analyst",
  );
});
