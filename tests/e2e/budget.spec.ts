import { expect, test } from "@playwright/test";

test("decides who gets the bonus pot, and sees how it lands", async ({
  page,
}) => {
  await page.goto("/?seed=2&month=6");
  await expect(page.getByTestId("month")).toContainText("6 of 9");

  await page.getByTestId("option-invent-dates").click();
  await page.getByTestId("continue").click();

  const budget = page.getByTestId("panel-notification");
  await expect(budget).toContainText("Bonus pot");
  await expect(page.getByTestId("option-bonus-allies")).toBeVisible();
  await expect(page.getByTestId("option-bonus-workers")).toBeVisible();
  await expect(page.getByTestId("option-bonus-boss")).toBeVisible();
  await expect(page.getByTestId("option-bonus-split")).toBeVisible();
  await page.getByTestId("option-bonus-allies").click();

  await expect(page.getByTestId("panel-notice")).toContainText("bonus");
  await expect(page.getByTestId("boss-reaction")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/remaining|balance/i);
});
