import { expect, test } from "@playwright/test";
import { answerAnyNotification, happened, readResult } from "./play";

test("sees your boss alone in your boss's office, once a month", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await answerAnyNotification(page);
  await page.getByTestId("hotspot-boss-office").click();

  await expect(page.getByTestId("panel-scene")).toBeVisible();
  await expect(page.getByTestId("person")).toHaveCount(1);
  await expect(page.getByTestId("behaviour")).toHaveCount(1);
  await expect(page.getByTestId("sign")).toHaveCount(0);

  await page.getByTestId("scene-option-real-figures").click();

  await expect(happened(page)).toContainText("real figures");
  await expect(page.getByTestId("hotspot-boss-office")).toBeDisabled();
  await readResult(page);
  await expect(page.getByTestId("hotspot-kitchen")).toBeEnabled();
});
