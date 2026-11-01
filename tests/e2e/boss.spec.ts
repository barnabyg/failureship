import { expect, test, type Page } from "@playwright/test";
import {
  answerAnyNotification,
  finishMonth,
  openMeeting,
  playToResults,
} from "./play";

/** One choice in month 1's meeting, then how the boss is with you in month 2. */
async function treatmentAfter(page: Page, seed: number, option: string) {
  await page.goto(`/?seed=${String(seed)}`);
  await answerAnyNotification(page);
  await openMeeting(page);
  await page.getByTestId(`scene-option-${option}`).click();
  await finishMonth(page);
  await answerAnyNotification(page);
  await openMeeting(page);
  return page.getByTestId("treatment").innerText();
}

test("the boss treats you differently after a choice", async ({ page }) => {
  const changed: number[] = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    const pleased = await treatmentAfter(page, seed, "back-boss");
    const snubbed = await treatmentAfter(page, seed, "back-head");
    if (pleased !== snubbed) changed.push(seed);
    if (changed.length > 0) break;
  }

  expect(changed.length).toBeGreaterThan(0);
});

test("the boss's opinion never appears as a number or label", async ({
  page,
}) => {
  await treatmentAfter(page, 1, "back-boss");

  const seen = await page.locator("main").innerText();
  expect(seen).not.toMatch(/opinion|\d+\s*%/i);
  await expect(page.locator(".status")).not.toContainText(/opinion|mood/i);
});

// The real-content test keeps seed 1's boss a Believer and seed 8's Incompetent.
test("the same choice lands differently with a different kind of boss", async ({
  page,
}) => {
  const reactionOnSeed = async (seed: number) => {
    await page.goto(`/?seed=${String(seed)}`);
    await answerAnyNotification(page);
    await openMeeting(page);
    await page.getByTestId("scene-option-back-boss").click();
    return page.getByTestId("boss-reaction").innerText();
  };

  const believer = await reactionOnSeed(1);
  const incompetent = await reactionOnSeed(8);

  expect(believer).not.toEqual(incompetent);
  expect(`${believer} ${incompetent}`).not.toMatch(
    /Believer|Incompetent|Practitioner/i,
  );
});

test("the results screen shows the boss's kind and how choices landed", async ({
  page,
}) => {
  await page.goto("/?seed=8");
  await answerAnyNotification(page);
  await openMeeting(page);
  await page.getByTestId("scene-option-back-boss").click();
  await playToResults(page);

  await expect(page.getByTestId("result-boss-kind")).toHaveText("Incompetent");
  await expect(page.getByTestId("result-boss-choice").first()).toContainText(
    "Went down well",
  );
});
