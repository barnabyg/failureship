import { expect, test } from "@playwright/test";
import { freshRun, playUntil } from "./play";

// tests/engine/real-vacancies.test.ts keeps these deals true. Taking the blame
// in month 2 and faking the Plan at month 5's Ideas Workshop completes it, your
// boss counts it done, and the seat is open in months 6 and 7. A word with the
// Senior Analyst in month 6 makes it yours on seed 2; on seed 14 a Rival has it.
const FAKED =
  "choose=take-the-blame,screenshot-on-the-note,word-with-the-analyst";

test("win the seat, and ride the lift to Floor 2", async ({ page }) => {
  await freshRun(page, `/?seed=2&month=7&${FAKED}`);
  await expect(page.getByTestId("room-sign-lift")).toContainText(
    "By promotion only",
  );
  await page.getByTestId("open-org-chart").click();
  await expect(page.getByTestId("org-chart")).not.toContainText("Gwen Ashdown");
  await page.getByTestId("close-org-chart").click();

  // The news first, still on Floor 1, and then the ride.
  await playUntil(page, "decided");
  const told = page.getByTestId("panel-notice");
  await expect(told).toContainText("Congratulations: Team lead");
  await expect(page.getByTestId("decided-on-paper")).toContainText(
    "Official standing",
  );
  await expect(page.getByTestId("decided-in-fact")).toContainText(
    "The seat was in the gift of",
  );
  await expect(page.getByTestId("room-sign-lift")).toBeVisible();
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("lift-ride-floors")).toContainText("Floor 1");
  await expect(page.getByTestId("lift-ride-floors")).toContainText("Floor 2");
  // Coming back mid-ride carries on with it. Without the later-month start,
  // which only a new run takes.
  await page.goto("/?seed=2");
  await page.getByTestId("lift-step-out").click();

  await expect(page.getByTestId("job-title")).toHaveText("Team lead");
  await expect(page.getByTestId("month")).toContainText("8 of 18");
  await expect(page.getByTestId("room-sign-lift-2")).toContainText("Floor 3");
  await expect(page.getByTestId("room-sign-lift")).toHaveCount(0);

  await page.getByTestId("open-org-chart").click();
  const chart = page.getByTestId("org-chart");
  await expect(chart).toContainText("Hugh Lamb");
  await expect(chart).toContainText("Head of Operations, your boss");
  await expect(chart).toContainText("Programme Manager, your boss's boss");
  await expect(chart).toContainText("You");
  await expect(chart).toContainText("Gwen Ashdown");
  await page.getByTestId("close-org-chart").click();

  // Floor 2's own month: its own meeting, in its own room.
  await playUntil(page, "hotspot-meeting-induction");
  await page.getByTestId("hotspot-meeting-induction").click();
  await expect(page.getByTestId("panel-scene")).toContainText(
    "Leadership Induction",
  );
});

test("lose the seat to a Rival, who becomes your boss", async ({ page }) => {
  await freshRun(page, `/?seed=14&month=7&${FAKED}`);

  await playUntil(page, "decided");
  const told = page.getByTestId("panel-notice");
  await expect(told).toContainText("Congratulations to the Junior Associate");
  await expect(told).toContainText("who is now your boss");
  await expect(page.getByTestId("decided-in-fact")).toContainText(
    "the Junior Associate",
  );
  await expect(page.getByTestId("decided-in-fact")).not.toContainText(
    /Rival|As for you/,
  );
  await expect(page.getByTestId("lift-ride")).toHaveCount(0);
  await expect(page.getByTestId("job-title")).toHaveText("Junior employee");
  await expect(page.getByTestId("room-sign-lift")).toBeVisible();

  await page.getByTestId("continue").click();
  await page.getByTestId("open-org-chart").click();
  await expect(page.getByTestId("org-chart")).toContainText(
    "Team Leader, your boss",
  );
  await expect(page.getByTestId("org-chart")).toContainText(
    "Head of Special Projects",
  );
});
