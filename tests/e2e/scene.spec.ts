import { expect, test } from "@playwright/test";

test("opens the meeting Scene from the tower and makes a choice", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await page.getByTestId("option-report").click();
  await page.getByTestId("continue").click();

  await page.getByTestId("hotspot-meeting").click();

  await expect(page.getByTestId("panel-scene")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("actions-left")).toContainText("1");
  await expect(page.getByTestId("sign")).toHaveCount(3);

  await page.getByTestId("scene-option-say-nothing").click();

  await expect(page.getByTestId("panel-notice")).toBeVisible();
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("hotspot-meeting")).toBeDisabled();
  await expect(page.getByTestId("hotspot-kitchen")).toBeEnabled();
});

test("the report leaves no Buzzword option in the meeting", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await page.getByTestId("option-report").click();
  await page.getByTestId("continue").click();

  await page.getByTestId("hotspot-meeting").click();

  await expect(page.getByTestId("panel-scene")).toBeVisible();
  await expect(page.getByTestId("scene-option-use-buzzword")).toHaveCount(0);
});

test("the pub, then the meeting, then using the Buzzword", async ({ page }) => {
  await page.goto("/?seed=1");
  await page.getByTestId("option-pub").click();
  await page.getByTestId("continue").click();

  await page.getByTestId("hotspot-meeting").click();
  await page.getByTestId("scene-option-use-buzzword").click();

  await expect(page.getByTestId("panel-notice")).toBeVisible();
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("hotspot-meeting")).toBeDisabled();
});
