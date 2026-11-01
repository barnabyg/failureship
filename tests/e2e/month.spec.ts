import { expect, test, type Page } from "@playwright/test";

async function spendAction(page: Page, id: string) {
  await page.getByTestId(`hotspot-${id}`).click();
  await page.getByTestId("continue").click();
}

async function fileTheReport(page: Page) {
  await page.getByTestId("option-report").click();
  await page.getByTestId("continue").click();
}

test("plays through a month on a fixed-camera Floor 1", async ({ page }) => {
  await page.goto("/?seed=1");

  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("actions-left")).toContainText("3");
  await fileTheReport(page);
  await expect(page.getByTestId("actions-left")).toContainText("2");

  await spendAction(page, "kitchen");
  await expect(page.getByTestId("actions-left")).toContainText("1");

  await spendAction(page, "work");

  await expect(page.getByTestId("panel-move")).toBeVisible();
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("panel-story")).toBeVisible();
  await expect(page.getByTestId("panel-story")).toContainText(
    "Junior employee Monthly Summary",
  );
  await expect(page.getByTestId("job-title")).toHaveText("Junior employee");
  await expect(page.getByTestId("hotspot-meeting")).toBeDisabled();
});

test("plays from month 1 into month 2", async ({ page }) => {
  await page.goto("/?seed=1");
  await expect(page.getByTestId("month")).toContainText("1 of 6");
  await fileTheReport(page);
  await spendAction(page, "kitchen");
  await spendAction(page, "work");
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("panel-story")).toBeVisible();
  await expect(page.getByTestId("month")).toContainText("1 of 6");

  await page.getByTestId("continue").click();

  await expect(page.getByTestId("month")).toContainText("2 of 6");
  await expect(page.getByTestId("actions-left")).toContainText("3");
  await expect(page.getByTestId("panel-notification")).toBeVisible();
});

test("opens and closes the Org Chart at no cost in actions", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await fileTheReport(page);
  await expect(page.getByTestId("actions-left")).toContainText("2");

  await page.getByTestId("open-org-chart").click();

  const chart = page.getByTestId("org-chart");
  await expect(chart).toContainText("Hugh Lamb");
  await expect(chart).toContainText("Callum Reed");
  await page.getByTestId("close-org-chart").click();

  await expect(chart).toHaveCount(0);
  await expect(page.getByTestId("actions-left")).toContainText("2");
  await page.getByTestId("hotspot-kitchen").click();
  await expect(page.getByTestId("panel-notice")).toBeVisible();
});

test("spends an action by clicking on the floor itself", async ({ page }) => {
  await page.goto("/?seed=1");
  await fileTheReport(page);

  const label = page.getByTestId("hotspot-kitchen");
  const box = await label.boundingBox();
  if (!box) throw new Error("The hotspot has no position.");

  // Each label sits just above its room, so this lands on the room's model.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 24);

  await expect(page.getByTestId("panel-notice")).toBeVisible();
  await expect(page.getByTestId("actions-left")).toContainText("1");
});

test("offers no way to move the camera", async ({ page }) => {
  await page.goto("/?seed=1");
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();

  await canvas.hover();
  await page.mouse.down();
  await page.mouse.move(100, 100);
  await page.mouse.up();
  await page.mouse.wheel(0, 600);
  await page.mouse.move(2, 2);

  expect(await canvas.screenshot()).toEqual(before);
});
