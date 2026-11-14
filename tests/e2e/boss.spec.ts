import { expect, test } from "@playwright/test";
import {
  answerAnyNotification,
  finishMonth,
  openMeeting,
  playToResults,
} from "./play";

// What the boss comes to think, how each kind takes a choice, and that a choice
// changes how the boss treats you are the engine's: tests/engine/boss.test.ts and
// boss-kinds.test.ts. This checks the browser shows the reaction and then the
// treatment, in words alone.
test("the boss reacts to a choice, and treats you by it the next month, in words alone", async ({
  page,
}) => {
  await page.goto("/?seed=4");
  await answerAnyNotification(page);
  await openMeeting(page);
  await page.getByTestId("scene-option-back-boss").click();
  const reaction = page.getByTestId("boss-reaction");
  await expect(reaction).not.toBeEmpty();
  await expect(reaction).not.toContainText(
    /Believer|Incompetent|Practitioner/i,
  );

  await finishMonth(page);
  await answerAnyNotification(page);
  await openMeeting(page);
  await expect(page.getByTestId("treatment")).not.toBeEmpty();
  const seen = await page.locator("main").innerText();
  expect(seen).not.toMatch(/opinion|\d+\s*%/i);
  await expect(page.locator(".status")).not.toContainText(/opinion|mood/i);
});

// Flattery in the last month's meeting, so the results screen is a month away.
test("the results screen shows the boss's kind and how choices landed", async ({
  page,
}) => {
  await page.goto("/?seed=283&month=9&last=9");
  await answerAnyNotification(page);
  await openMeeting(page);
  await page.getByTestId("scene-option-praise-dennis").click();
  await playToResults(page);

  await expect(page.getByTestId("result-boss-kind")).toHaveText("Incompetent");
  await expect(
    page
      .getByTestId("result-boss-choice")
      .filter({ hasText: "Say how much your boss taught you" }),
  ).toContainText("Went down well");
});
