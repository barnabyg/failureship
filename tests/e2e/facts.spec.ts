import { expect, test, type Page } from "@playwright/test";
import {
  answerAnyNotification,
  finishMonth,
  openMeeting,
  playToResults,
  freshRun,
} from "./play";

async function fileTheReport(page: Page) {
  await answerAnyNotification(page);
}

// The real-content test keeps these seeds true: the Office Co-ordinator tells you in month 8 of
// seed 87 about your boss's post, and the Senior Analyst really has a dangerous fact on seed 96.
test("a discovered Hidden Fact changes what a Scene offers", async ({
  page,
}) => {
  // Without asking in month 8, month 9's meeting has no such option.
  await page.goto("/?seed=87&month=9");
  await answerAnyNotification(page);
  await openMeeting(page);
  await expect(page.getByTestId("panel-scene")).toContainText(
    "Annual Calibration",
  );
  await expect(
    page.getByTestId("scene-option-use-abolished-post-calibration"),
  ).toHaveCount(0);

  await freshRun(page, "/?seed=87&month=8");
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
  await page.goto("/?seed=96&month=8");
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
