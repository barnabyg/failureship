import { expect, test, type Page } from "@playwright/test";
import {
  answerAnyNotification,
  happened,
  openInboxIfAny,
  readResult,
} from "./play";

async function spendAction(page: Page, id: string) {
  await page.getByTestId(`hotspot-${id}`).click();
  await readResult(page);
}

async function fileTheReport(page: Page) {
  await answerAnyNotification(page);
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

  // One panel tells the month's close: the minutes of the meeting missed, before
  // anything else that landed, then the official story.
  const story = page.getByTestId("panel-story");
  await expect(story).toBeVisible();
  await expect(story.getByTestId("landed")).toHaveCount(2);
  await expect(story.getByTestId("landed").first()).toHaveAttribute(
    "data-kind",
    "notice",
  );
  await expect(story.getByTestId("landed").last()).toHaveAttribute(
    "data-kind",
    "move",
  );
  await expect(story).toContainText("Junior employee Monthly Summary");
  await expect(page.getByTestId("job-title")).toHaveText("Junior employee");
  await expect(page.getByTestId("hotspot-meeting")).toBeDisabled();
});

test("plays from month 1 into month 2", async ({ page }) => {
  await page.goto("/?seed=1");
  await expect(page.getByTestId("month")).toContainText("1 of 18");
  await fileTheReport(page);
  await spendAction(page, "kitchen");
  await spendAction(page, "work");
  await expect(page.getByTestId("panel-story")).toBeVisible();
  await expect(page.getByTestId("month")).toContainText("1 of 18");

  await page.getByTestId("continue").click();

  await expect(page.getByTestId("month")).toContainText("2 of 18");
  await expect(page.getByTestId("actions-left")).toContainText("3");
  await openInboxIfAny(page);
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
  await expect(happened(page)).toBeVisible();
});

test("spends an action by clicking on the floor itself", async ({ page }) => {
  await page.goto("/?seed=1");
  await fileTheReport(page);

  const label = page.getByTestId("hotspot-kitchen");
  const box = await label.boundingBox();
  if (!box) throw new Error("The hotspot has no position.");

  // Each label sits just above its room, so this lands on the room's model.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 24);

  await expect(happened(page)).toBeVisible();
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
