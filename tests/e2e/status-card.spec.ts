import { expect, test } from "@playwright/test";
import { freshRun, openInboxIfAny, playUntil } from "./play";

test("one compact status card, with a Grand Plan and an open Demand, each part opening its panel", async ({
  page,
}) => {
  await freshRun(page, "/?seed=1&month=4");
  await playUntil(page, "option-stall");
  await openInboxIfAny(page);
  await page.getByTestId("option-stall").click();

  const card = page.getByTestId("status-card");
  await expect(page.getByTestId("grand-plan-card")).toBeVisible();
  await expect(page.getByTestId("open-demands")).toContainText("1");
  await expect(page.getByTestId("standing-card")).toBeVisible();
  const box = await card.boundingBox();
  if (!box) throw new Error("No card to measure.");
  expect(box.height).toBeLessThanOrEqual(120);

  for (const [part, panel, close] of [
    ["open-project", "project", "close-project"],
    ["grand-plan-card", "grand-plan", "close-project"],
    ["open-demands", "open-demand", "close-project"],
    ["open-word", "word", "close-word"],
  ] as const) {
    await page.getByTestId(part).click();
    await expect(page.getByTestId(panel).first(), part).toBeVisible();
    await page.getByTestId(close).click();
  }
});

test("the goal is said in full in month 1 only, and after that in the guide's tooltip", async ({
  page,
}) => {
  await freshRun(page, "/?seed=1");
  await expect(page.getByTestId("goal")).toBeVisible();

  await freshRun(page, "/?seed=1&month=2");
  await expect(page.getByTestId("hint")).not.toBeEmpty();
  await expect(page.getByTestId("goal")).toHaveCount(0);
  await expect(page.locator(".next")).toHaveAttribute(
    "title",
    /get promoted, seat by seat/,
  );
});
