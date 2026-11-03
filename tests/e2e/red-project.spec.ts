import { expect, test, type Page } from "@playwright/test";
import {
  answerAnyNotification,
  attendAndFinishMonth,
  skipTheReport,
} from "./play";

/** Two skipped reports turn the Project from green to red. Seed 4 has no late input. */
async function turnProjectRed(page: Page) {
  await page.goto("/?seed=4");
  await page.getByTestId("option-decline").click();
  await page.getByTestId("continue").click();
  await skipTheReport(page);
  await attendAndFinishMonth(page);
  await page.getByTestId("option-skip-training").click();
  await page.getByTestId("continue").click();
  await page.getByTestId("option-push-back").click();
  await page.getByTestId("continue").click();
  await skipTheReport(page);
}

async function reportedStatus(page: Page) {
  await page.getByTestId("open-project").click();
  const status = await page.getByTestId("project-reported").innerText();
  await page.getByTestId("close-project").click();
  return status;
}

test("a Project flagged red has to be explained, and explaining can change it", async ({
  page,
}) => {
  await turnProjectRed(page);

  const scene = page.getByTestId("panel-scene");
  await expect(scene.locator("h2")).toHaveText("Project Status Review");
  await expect(page.getByTestId("month")).toContainText("2 of 9");
  expect(await reportedStatus(page)).toBe("Red");

  await page.getByTestId("scene-option-make-it-amber").click();
  await expect(page.getByTestId("panel-notice")).toBeVisible();

  expect(await reportedStatus(page)).toBe("Amber");
});

test("telling the truth leaves the Project red, and is not asked for twice", async ({
  page,
}) => {
  await turnProjectRed(page);

  await page.getByTestId("scene-option-tell-the-truth").click();
  await page.getByTestId("continue").click();

  expect(await reportedStatus(page)).toBe("Red");
  await expect(page.getByTestId("panel-scene")).toHaveCount(0);
  await expect(page.getByTestId("hotspot-meeting-lessons")).toBeEnabled();
});

test("a Project that never goes red still has a meeting in month 5", async ({
  page,
}) => {
  // Plain play to month 5 files every report, so the Project never goes red.
  await page.goto("/?seed=4&month=5");
  await expect(page.getByTestId("month")).toContainText("5 of 9");
  expect(await reportedStatus(page)).not.toBe("Red");
  await answerAnyNotification(page);
  await page.getByTestId("hotspot-meeting-workshop").click();

  await expect(page.getByTestId("panel-scene").locator("h2")).toHaveText(
    "Ideas Workshop",
  );
});
