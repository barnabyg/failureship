import { expect, test } from "@playwright/test";
import {
  answerAnyNotification,
  happened,
  openMeeting,
  playToResults,
} from "./play";

test("goes over your boss's head, and reads the outcome and the reveal", async ({
  page,
}) => {
  await page.goto("/?seed=58&month=8&last=9");
  await answerAnyNotification(page);

  await page.getByTestId("hotspot-over-head").click();

  const told = happened(page);
  // The real-content test keeps this seed's trip paying off.
  await expect(told).toContainText("told to listen to you");
  await expect(told).not.toContainText(/Believer|Incompetent|Practitioner/);
  await expect(page.getByTestId("hotspot-over-head")).toBeDisabled();

  await openMeeting(page);
  await expect(page.getByTestId("head-treatment")).toBeVisible();
  await page.locator('[data-testid^="scene-option-"]').first().click();

  await playToResults(page);
  await expect(page.getByTestId("result-head-kind")).toContainText(
    /Believer|Incompetent|Practitioner/,
  );
  await page.getByTestId("results-section-head").locator("summary").click();
  await expect(page.getByTestId("result-head-verdict")).toBeVisible();
});
