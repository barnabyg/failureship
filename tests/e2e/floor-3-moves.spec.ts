import { expect, test } from "@playwright/test";
import { freshRun, playUntil } from "./play";

// tests/engine/browser-seeds.test.ts keeps this deal true. On seed 24, taking
// the blame in month 2, faking the Plan in month 5 and staffing the Centre of
// Excellence on Floor 2 make a Middle manager of you in month 12. Month 15 is
// Floor 3's fourth month, with its Board.
const TO_FLOOR_3 =
  "choose=take-the-blame,screenshot-on-the-note,staff-the-centre";

test("take the Board's tricky question offline, and hear from the Board Office about it", async ({
  page,
}) => {
  await freshRun(page, `/?seed=24&month=15&${TO_FLOOR_3}`);
  await expect(page.getByTestId("job-title")).toHaveText("Middle manager");

  await playUntil(page, "hotspot-meeting-the-board");
  await page.getByTestId("hotspot-meeting-the-board").click();
  const board = page.getByTestId("panel-scene");
  await expect(board).toContainText("The Board");
  await expect(board).toContainText("asks, warmly");
  await page.getByTestId("scene-option-take-it-offline").click();
  await expect(page.getByTestId("panel-notice")).toContainText(
    "would like the answer offline",
  );
  await page.getByTestId("continue").click();

  await playUntil(page, "option-still-offline");
  await expect(page.getByTestId("month")).toContainText("16 of 18");
  const chased = page.getByTestId("panel-notification");
  await expect(chased).toContainText("Your offline answer");
  await expect(chased).toContainText("slide seven");
  await page.getByTestId("option-still-offline").click();
  await expect(page.getByTestId("panel-notice")).toContainText("as item one");
});
