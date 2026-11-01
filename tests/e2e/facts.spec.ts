import { expect, test, type Page } from "@playwright/test";
import {
  answerAnyNotification,
  finishMonth,
  openMeeting,
  playToResults,
} from "./play";

async function fileTheReport(page: Page) {
  await page.getByTestId("option-report").click();
  await page.getByTestId("continue").click();
}

// The real-content test keeps these seeds true: the Office Co-ordinator tells you on seed 22
// about your boss's post, and the Project Co-ordinator really has a dangerous fact on seed 3.
test("a discovered Hidden Fact changes what a Scene offers", async ({
  page,
}) => {
  await page.goto("/?seed=22");
  await fileTheReport(page);
  await finishMonth(page);
  await answerAnyNotification(page);
  await openMeeting(page);
  await expect(page.getByTestId("scene-option-use-abolished-post")).toHaveCount(
    0,
  );

  await page.goto("/?seed=22");
  await fileTheReport(page);
  await page.getByTestId("hotspot-inside-info").click();
  await page.getByTestId("source-admin").click();
  await page.getByTestId("subject-boss").click();
  await expect(page.getByTestId("claim-text")).toContainText("abolished");
  await finishMonth(page);
  await answerAnyNotification(page);
  await openMeeting(page);

  const option = page.getByTestId("scene-option-use-abolished-post");
  await expect(option).toContainText("your boss");
  await option.click();

  await expect(page.getByTestId("panel-notice")).toContainText("Your boss");
  await playToResults(page);
  await expect(page.getByTestId("result-fact-event")).toContainText(
    "abolished",
  );
});

test("blundering into a dangerous Hidden Fact is explained at the end", async ({
  page,
}) => {
  await page.goto("/?seed=3");
  await fileTheReport(page);
  await finishMonth(page);
  await answerAnyNotification(page);
  await openMeeting(page);

  await page.getByTestId("scene-option-blame-callum").click();
  await expect(page.getByTestId("panel-notice")).toContainText("Thursday");

  await playToResults(page);
  await expect(page.getByTestId("result-fact-event")).toContainText(
    "the Project Co-ordinator",
  );
});
