import { expect, test } from "@playwright/test";

test("the month opens with a Notification that must be answered", async ({
  page,
}) => {
  await page.goto("/?seed=1");

  await expect(page.getByTestId("panel-notification")).toBeVisible();
  await expect(page.getByTestId("hotspot-kitchen")).toBeDisabled();
  await expect(page.getByTestId("option-pub")).toContainText("1 action");
  await expect(page.getByTestId("option-report")).toContainText("1 action");
});

test("the pub is a text dialog with the office still behind it", async ({
  page,
}) => {
  await page.goto("/?seed=1");

  await page.getByTestId("option-pub").click();

  await expect(page.getByTestId("panel-dialog")).toBeVisible();
  await expect(page.getByTestId("learned")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("hotspot-meeting")).toBeVisible();
  await expect(page.getByTestId("actions-left")).toContainText("2");
  await expect(page.getByTestId("buzzwords")).toBeVisible();

  await page.getByTestId("continue").click();

  await expect(page.getByTestId("hotspot-kitchen")).toBeEnabled();
});

test("the report teaches no Buzzword", async ({ page }) => {
  await page.goto("/?seed=1");

  await page.getByTestId("option-report").click();
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("hotspot-kitchen")).toBeEnabled();
  await expect(page.getByTestId("buzzwords")).toHaveCount(0);
});
