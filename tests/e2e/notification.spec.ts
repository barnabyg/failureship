import { expect, test } from "@playwright/test";
import { answered, openInboxIfAny } from "./play";

test("the month opens with its Notifications in the inbox, beside an open floor", async ({
  page,
}) => {
  await page.goto("/?seed=1");

  await openInboxIfAny(page);
  await expect(page.getByTestId("panel-notification")).toBeVisible();
  await expect(page.getByTestId("hotspot-kitchen")).toBeEnabled();
  await expect(page.getByTestId("option-pub")).toContainText("1 action");
  await expect(page.getByTestId("option-decline")).toContainText(
    "Costs nothing",
  );
  await page.getByTestId("option-decline").click();
  await expect(page.getByTestId("option-report")).toContainText("1 action");
  await expect(page.getByTestId("option-lie")).toContainText("1 action");
  await expect(page.getByTestId("option-skip")).toContainText("Costs nothing");
});

test("the pub is a text dialog, in the e-mail it answers, with the office still behind it", async ({
  page,
}) => {
  await page.goto("/?seed=1");

  await openInboxIfAny(page);
  await page.getByTestId("option-pub").click();

  await expect(answered(page)).toContainText("Go to the pub");
  await expect(page.getByTestId("learned")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("hotspot-meeting")).toBeVisible();
  await expect(page.getByTestId("actions-left")).toContainText("2");
  await expect(page.getByTestId("buzzwords")).toBeVisible();
  await expect(page.getByTestId("panel-notification")).toBeVisible();

  await page.getByTestId("option-report").click();

  await expect(page.getByTestId("hotspot-kitchen")).toBeEnabled();
});

test("the report teaches no Buzzword", async ({ page }) => {
  await page.goto("/?seed=1");

  await openInboxIfAny(page);
  await page.getByTestId("option-decline").click();
  await page.getByTestId("option-report").click();

  await expect(page.getByTestId("hotspot-kitchen")).toBeEnabled();
  await expect(page.getByTestId("buzzwords")).toHaveCount(0);
});
