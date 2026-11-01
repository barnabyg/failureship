import { expect, test, type Page } from "@playwright/test";
import { finishMonth } from "./play";

async function openProject(page: Page) {
  await page.getByTestId("open-project").click();
  await expect(page.getByTestId("project")).toBeVisible();
}

async function closeProject(page: Page) {
  await page.getByTestId("close-project").click();
  await expect(page.getByTestId("project")).toHaveCount(0);
}

async function reachTheReport(page: Page) {
  await page.getByTestId("option-decline").click();
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("option-report")).toBeVisible();
}

test("lying in the report sets the reported status apart from the real one", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await reachTheReport(page);

  await page.getByTestId("option-report").click();
  await openProject(page);
  await expect(page.getByTestId("project-real")).toHaveText("Amber");
  await expect(page.getByTestId("project-reported")).toHaveText("Amber");
  await closeProject(page);

  await page.goto("/?seed=1");
  await reachTheReport(page);
  await page.getByTestId("option-lie").click();

  await openProject(page);
  await expect(page.getByTestId("project-real")).toHaveText("Amber");
  await expect(page.getByTestId("project-reported")).toHaveText("Green");
  await closeProject(page);
  await page.getByTestId("continue").click();
  await finishMonth(page);

  await expect(page.getByTestId("month")).toContainText("2 of 6");
  await openProject(page);
  await expect(page.getByTestId("project-reported")).toHaveText("Green");
});

test("the Project can be looked at from any step, at no cost", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  const left = (await page.getByTestId("actions-left").textContent()) ?? "";

  await openProject(page);
  await expect(page.getByTestId("project-owner")).toContainText("You");
  await closeProject(page);

  await expect(page.getByTestId("panel-notification")).toBeVisible();
  await expect(page.getByTestId("actions-left")).toHaveText(left);
});

test("doing the work improves the real status, and nothing else", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await reachTheReport(page);
  await page.getByTestId("option-lie").click();
  await page.getByTestId("continue").click();

  await page.getByTestId("hotspot-work").click();

  await openProject(page);
  await expect(page.getByTestId("project-real")).toHaveText("Green");
});
