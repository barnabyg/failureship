import { expect, test } from "@playwright/test";
import { answerAnyNotification, openMeeting, playToResults } from "./play";

test("goes over your boss's head, and reads the outcome and the reveal", async ({
  page,
}) => {
  await page.goto("/?seed=5&month=8");
  await answerAnyNotification(page);

  await page.getByTestId("hotspot-over-head").click();

  const told = page.getByTestId("panel-notice");
  // The real-content test keeps this seed's trip paying off.
  await expect(told).toContainText("told to listen to you");
  await expect(told).not.toContainText(/Believer|Incompetent|Practitioner/);
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("hotspot-over-head")).toBeDisabled();

  await openMeeting(page);
  await expect(page.getByTestId("head-treatment")).toBeVisible();
  await page.locator('[data-testid^="scene-option-"]').first().click();
  await page.getByTestId("continue").click();

  await playToResults(page);
  await expect(page.getByTestId("result-head-kind")).toContainText(
    /Believer|Incompetent|Practitioner/,
  );
  await expect(page.getByTestId("result-head-verdict")).toBeVisible();
});
