import { expect, test } from "@playwright/test";
import { freshRun, playUntil } from "./play";

// tests/engine/browser-seeds.test.ts keeps this deal true. On seed 16, taking
// the blame in month 2 and faking the Plan in month 5 wins the seat, and your
// boss on Floor 2 is a Believer. Month 11 is Floor 2's fourth month.
const CLEAN = "choose=take-the-blame,screenshot-on-the-note";

test("hire an old friend onto your team, and hear from a Believer boss about it", async ({
  page,
}) => {
  await freshRun(page, `/?seed=16&month=11&${CLEAN}`);
  await expect(page.getByTestId("job-title")).toHaveText("Team lead");

  await playUntil(page, "hotspot-meeting-team-hire");
  await page.getByTestId("hotspot-meeting-team-hire").click();
  await expect(page.getByTestId("panel-scene")).toContainText(
    "Hiring Decision",
  );
  await page.getByTestId("scene-option-hire-your-friend").click();
  await expect(page.getByTestId("panel-notice")).toContainText(
    "Your friend starts on Monday",
  );
  await page.getByTestId("continue").click();

  await playUntil(page, "option-own-the-hire");
  await expect(page.getByTestId("month")).toContainText("12 of 18");
  const furious = page.getByTestId("panel-notification");
  await expect(furious).toContainText("A word about your new hire");
  await expect(furious).toContainText("appalled");
  await page.getByTestId("option-own-the-hire").click();
  await expect(page.getByTestId("panel-notice")).toContainText(
    "Your friend leaves",
  );
});
