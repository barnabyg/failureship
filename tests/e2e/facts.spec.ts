import { expect, test, type Page } from "@playwright/test";
import {
  answerAnyNotification,
  finishMonth,
  openMeeting,
  playToResults,
} from "./play";

async function fileTheReport(page: Page) {
  await answerAnyNotification(page);
}

// The real-content test keeps these seeds true: the Office Co-ordinator tells you in month 8 of
// seed 74 about your boss's post, and the Senior Analyst really has a dangerous fact on seed 1.
test("a discovered Hidden Fact changes what a Scene offers", async ({
  page,
}) => {
  await page.goto("/?seed=74&month=8");
  await fileTheReport(page);
  await finishMonth(page);
  await answerAnyNotification(page);
  await openMeeting(page);
  await expect(
    page.getByTestId("scene-option-use-abolished-post-calibration"),
  ).toHaveCount(0);

  await page.goto("/?seed=74&month=8");
  await fileTheReport(page);
  await page.getByTestId("hotspot-inside-info").click();
  await page.getByTestId("source-admin").click();
  await page.getByTestId("subject-boss").click();
  await expect(page.getByTestId("claim-text")).toContainText("abolished");
  await finishMonth(page);
  await answerAnyNotification(page);
  await openMeeting(page);

  const option = page.getByTestId(
    "scene-option-use-abolished-post-calibration",
  );
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
  await page.goto("/?seed=1&month=8");
  await fileTheReport(page);
  await openMeeting(page);

  await page.getByTestId("scene-option-report-the-analyst").click();
  await expect(page.getByTestId("panel-notice")).toContainText(
    "your own expenses",
  );

  await playToResults(page);
  await expect(page.getByTestId("result-fact-event")).toContainText(
    "the Senior Analyst",
  );
});
