import { expect, test } from "@playwright/test";
import { freshRun, openInboxIfAny, playUntil, readAnyResult } from "./play";

// tests/engine/browser-seeds.test.ts keeps this deal true. On seed 2, taking
// the blame in month 2, faking the Plan in month 5, claiming its credit and a
// word with the Senior Analyst wins Floor 1's seat. A sign on the Centre of
// Excellence's door in month 9 and a word with the Office Co-ordinator win
// Floor 2's, as month 11 closes. Floor 3's Plan done for show in month 13
// opens its seat, and claiming its credit makes it yours as month 15 closes.
// The same choices as CLIMB in tests/engine/the-climb.test.ts.
const CLIMB =
  "choose=take-the-blame,screenshot-on-the-note,claim-the-credit,word-with-the-analyst,sign-on-a-door,word-with-the-coordinator-2";

test("says the goal on the first screen", async ({ page }) => {
  await freshRun(page, "/?seed=8");

  await openInboxIfAny(page);
  await expect(page.getByTestId("panel-notification")).toBeVisible();
  await expect(page.getByTestId("goal")).toHaveText(
    "Your goal: get promoted, seat by seat, to the top of Floor 3. Work out who really decides.",
  );
});

test("ride the lift to Floor 3, do its Grand Plan, and win the way out of it", async ({
  page,
}) => {
  test.slow();
  await freshRun(page, `/?seed=2&month=11&${CLIMB}`);
  await expect(page.getByTestId("job-title")).toHaveText("Team lead");

  await playUntil(page, "decided");
  await expect(page.getByTestId("panel-notice")).toContainText(
    "Congratulations: Middle manager",
  );
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("lift-ride-floors")).toContainText(
    "Floor 2. The doors close.",
  );
  await expect(page.getByTestId("lift-ride-floors")).toContainText("Floor 3.");
  await page.getByTestId("lift-step-out").click();
  await expect(page.getByTestId("job-title")).toHaveText("Middle manager");
  await expect(page.getByTestId("month")).toContainText("12 of 18");

  await playUntil(page, "hotspot-meeting-board-offsite");
  await page.getByTestId("hotspot-meeting-board-offsite").click();
  await expect(page.getByTestId("panel-scene")).toContainText(
    "The Board Offsite",
  );
  await page.getByTestId("scene-option-draw-swimlanes").click();
  await readAnyResult(page);

  await expect(page.getByTestId("panel-notice")).toContainText(
    "One Roadmap is done, as far as anyone can see",
  );

  await playUntil(page, "option-claim-it-middle-manager");
  await page.getByTestId("option-claim-it-middle-manager").click();

  await playUntil(page, "panel-win");
  await expect(page.getByTestId("month")).toContainText("15 of 18");
  const win = page.getByTestId("panel-win");
  await expect(win).toContainText("The top of Floor 3");
  await expect(win).toContainText(
    "Floors 4 to 10 are closed for refurbishment",
  );
  await page.getByTestId("continue").click();

  const results = page.getByTestId("panel-results");
  await expect(results).toContainText("You have reached the top of Floor 3");
  await expect(page.getByTestId("results-ending")).toContainText("in month 15");
  const route = page.getByTestId("result-route");
  await expect(route).toHaveCount(3);
  await expect(route.nth(0)).toContainText("Month 7: Team lead");
  await expect(route.nth(1)).toContainText("Month 11: Middle manager");
  await expect(route.nth(2)).toContainText(
    "Month 15: the top of Floor 3, when Gwen Ashdown's Grand Plan was done for show",
  );
  await expect(page.getByTestId("lift-ride")).toHaveCount(0);
  await expect(page.getByTestId("goal")).toHaveCount(0);
});
