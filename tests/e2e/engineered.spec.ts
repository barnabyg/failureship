import { expect, test } from "@playwright/test";
import {
  answered,
  finishMonth,
  freshRun,
  openInboxIfAny,
  playUntil,
  readResult,
} from "./play";

// tests/engine/real-routes.test.ts keeps this deal true. Played plainly, seed 43
// never completes the Grand Plan, so the seat stays filled until month 8, when
// ringing the Speak Up line about your boss gets them fired. Their seat is
// open in months 9 and 10, and it is yours. Only the Office Co-ordinator knows
// who rang, and in month 12 their log reaches Human Resources. Blaming the
// Senior Analyst for the call fails, as their Hidden Fact is dangerous: a big
// mistake in the seat, which takes you back down the lift.
test("get rid of your boss, take their seat, and lose it when the call is traced", async ({
  page,
}) => {
  test.slow();
  await freshRun(page, "/?seed=43&month=8");

  await playUntil(page, "option-ring-about-your-boss");
  await openInboxIfAny(page);
  await page.getByTestId("option-ring-about-your-boss").click();
  await expect(answered(page)).toContainText("Speak Up");
  await readResult(page);

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
  await page.getByTestId("close-org-chart").click();

  // The call is traced, the wrong person is blamed, and the lift takes you
  // back down.
  await finishMonth(page);
  await playUntil(page, "escape-line-blame-the-analyst");
  await expect(page.getByTestId("panel-escape")).toContainText(
    "A note for the file",
  );
  await page.getByTestId("escape-line-blame-the-analyst").click();
  await playUntil(page, "lift-ride-floors");
  await expect(page.getByTestId("lift-ride-floors")).toContainText(
    /Floor 1\.$/,
  );
  await page.getByTestId("lift-step-out").click();
  await expect(page.getByTestId("job-title")).toHaveText("Junior employee");
  await expect(page.getByTestId("month")).toContainText("13 of 18");
});
