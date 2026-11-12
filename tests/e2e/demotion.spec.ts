import { expect, test } from "@playwright/test";
import { finishMonth, freshRun, playUntil } from "./play";

// tests/engine/real-vacancies.test.ts keeps these deals true. On seed 2,
// taking the blame in month 2 keeps the record clean, and faking the Plan at
// month 5's Ideas Workshop, with a word with the Senior Analyst while the
// seat is open, wins it as month 7 closes. The Senior Analyst's Hidden Fact
// is dangerous, and so is the Project Co-ordinator's.
const SEATED =
  "choose=take-the-blame,screenshot-on-the-note,word-with-the-analyst";
/** The same, and claiming the Plan's credit first, as tests/engine/real-runs.ts's CLEAN. */
const CLEAN =
  "choose=take-the-blame,screenshot-on-the-note,claim-the-credit,word-with-the-analyst";

test("a big mistake while the seat is open costs it, and the decision says so", async ({
  page,
}) => {
  await freshRun(page, `/?seed=2&month=7&${SEATED}`);

  await playUntil(page, "scene-option-sink-the-projects-candidate");
  await page.getByTestId("scene-option-sink-the-projects-candidate").click();
  await expect(page.getByTestId("panel-notice")).toContainText(
    "A letter in a plain envelope",
  );
  await expect(page.getByTestId("final-warning")).toBeVisible();

  await playUntil(page, "decided");
  const told = page.getByTestId("panel-notice");
  await expect(told).toContainText("Congratulations to the Junior Associate");
  await expect(told).toContainText("The incident during the process");
  await expect(page.getByTestId("decided-in-fact")).toContainText(
    "The incident report was taken into account",
  );
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("lift-ride")).toHaveCount(0);
  await expect(page.getByTestId("job-title")).toHaveText("Junior employee");
});

test("a big mistake on Floor 2 demotes you, and the lift takes you down", async ({
  page,
}) => {
  await freshRun(page, `/?seed=2&month=9&${CLEAN}`);
  await expect(page.getByTestId("job-title")).toHaveText("Team lead");

  await playUntil(page, "scene-option-blame-your-analyst");
  await page.getByTestId("scene-option-blame-your-analyst").click();

  await expect(page.getByTestId("panel-notice")).toContainText(
    "A letter in a plain envelope",
  );
  await expect(page.getByTestId("job-title")).toHaveText("Team lead");

  // The news first, still on Floor 2, and then the ride down.
  await finishMonth(page);
  const told = page.getByTestId("panel-notice");
  await expect(told).toContainText("A sideways move, downwards");
  await expect(told).toContainText("You now report to the Junior Associate");
  await expect(page.getByTestId("room-sign-lift-2")).toBeVisible();
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("lift-ride-floors")).toContainText(
    "Floor 2. The doors close.",
  );
  await expect(page.getByTestId("lift-ride-floors")).toContainText(
    /Floor 1\.$/,
  );
  await page.getByTestId("lift-step-out").click();

  await expect(page.getByTestId("job-title")).toHaveText("Junior employee");
  await expect(page.getByTestId("month")).toContainText("10 of 18");
  await expect(page.getByTestId("final-warning")).toBeVisible();
  await expect(page.getByTestId("room-sign-lift")).toContainText("Floor 2");
  await expect(page.getByTestId("room-sign-lift-2")).toHaveCount(0);

  await page.getByTestId("open-org-chart").click();
  const chart = page.getByTestId("org-chart");
  await expect(chart).toContainText("Team Leader, your boss");
  await expect(chart).toContainText("Head of Operations, your boss's boss");
  await page.getByTestId("close-org-chart").click();

  // Floor 1 picks up where it was left: its eighth month's meeting.
  await playUntil(page, "hotspot-meeting-speak-up");
  await page.getByTestId("hotspot-meeting-speak-up").click();
  await expect(page.getByTestId("panel-scene")).toContainText(
    "Speak Up Listening Session",
  );
});
