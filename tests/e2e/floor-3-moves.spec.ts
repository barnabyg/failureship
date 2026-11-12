import { expect, test } from "@playwright/test";
import {
  answered,
  freshRun,
  happened,
  openInboxIfAny,
  playUntil,
} from "./play";

// tests/engine/browser-seeds.test.ts keeps this deal true. On seed 24, taking
// the blame in month 2, faking the Plan in month 5 and staffing the Centre of
// Excellence on Floor 2 make a Middle manager of you in month 12. Month 14 is
// Floor 3's third month, with its Board, where your boss asks the question.
const TO_FLOOR_3 =
  "choose=take-the-blame,screenshot-on-the-note,claim-the-credit,word-with-the-analyst,staff-the-centre";

test("take the Board's tricky question offline, and hear from the Board Office about it", async ({
  page,
}) => {
  await freshRun(page, `/?seed=24&month=14&${TO_FLOOR_3}`);
  await expect(page.getByTestId("job-title")).toHaveText("Middle manager");

  await playUntil(page, "hotspot-meeting-the-board");
  await page.getByTestId("hotspot-meeting-the-board").click();
  const board = page.getByTestId("panel-scene");
  await expect(board).toContainText("The Board");
  await expect(board).toContainText(
    "twelve at the Board, your boss asks, warmly",
  );
  await expect(board).toContainText("How the question is asked");
  await page.getByTestId("scene-option-take-it-offline").click();
  await expect(happened(page)).toContainText("would like the answer offline");

  await playUntil(page, "option-still-offline");
  await expect(page.getByTestId("month")).toContainText("15 of 18");
  await openInboxIfAny(page);
  const chased = page.getByTestId("panel-notification");
  await expect(chased).toContainText("Your offline answer");
  await expect(chased).toContainText("slide seven");
  await page.getByTestId("option-still-offline").click();
  await expect(answered(page)).toContainText("as item one");
});
