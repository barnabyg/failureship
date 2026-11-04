import { expect, test } from "@playwright/test";
import { freshRun, playUntil } from "./play";

// tests/engine/real-routes.test.ts keeps this deal true. Played plainly, seed 87
// never completes the Grand Plan, so the seat stays filled until month 8, when
// ringing the Speak Up line about your boss gets them fired. Their seat is
// open in months 9 and 10, and it is yours.
test("get rid of your boss, take their seat, and ride the lift to Floor 2", async ({
  page,
}) => {
  await freshRun(page, "/?seed=87&month=8");

  await playUntil(page, "option-ring-about-your-boss");
  await page.getByTestId("option-ring-about-your-boss").click();
  await expect(page.getByTestId("panel-notice")).toContainText("Speak Up");
  await page.getByTestId("continue").click();

  // The boss goes, and the seat opens.
  const told = page.getByTestId("panel-notice");
  await expect(told).toContainText("A change in the team");
  await page.getByTestId("continue").click();
  await expect(told).toContainText("Following a review of conduct");
  await page.getByTestId("continue").click();

  await playUntil(page, "decided");
  await expect(told).toContainText("Congratulations: Team lead");
  await expect(page.getByTestId("decided-in-fact")).toContainText(
    "The seat was in the gift of",
  );
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("lift-ride-floors")).toContainText("Floor 2");
  await page.getByTestId("lift-step-out").click();
  await expect(page.getByTestId("job-title")).toHaveText("Team lead");
  await expect(page.getByTestId("month")).toContainText("11 of 18");

  await page.getByTestId("open-org-chart").click();
  await expect(page.getByTestId("org-chart")).not.toContainText(
    "Dennis Prowse",
  );
});
