import { expect, test } from "@playwright/test";
import { freshRun, happened, playUntil } from "./play";

// "Quarterly reviews" in tests/engine/reviews.test.ts checks the rules, and
// "the real quarterly reviews" there that the same choice moves the record the
// same way whatever the deal.
test("a quarterly review comes round by itself and moves Official standing", async ({
  page,
}) => {
  await page.goto("/?seed=106&month=3");
  const marker = page.getByTestId("standing").locator(".standing-marker");
  const actions = page.getByTestId("actions-left").locator("dd");

  // It opens after the month's Notifications, before any action is taken.
  await playUntil(page, "scene-option-bigger-arrow");
  const scene = page.getByTestId("panel-scene");
  await expect(scene.locator("h2")).toHaveText("Quarterly Business Review");
  const before = await marker.evaluate((m) => parseFloat(m.style.left));
  const spare = await actions.innerText();

  await page.getByTestId("scene-option-bigger-arrow").click();

  await expect(happened(page)).toBeVisible();
  await expect(marker).not.toHaveAttribute(
    "style",
    `left: ${String(before)}%;`,
  );
  const after = await marker.evaluate((m) => parseFloat(m.style.left));
  expect(after).toBeGreaterThan(before);
  // It took none of the month's actions.
  await expect(actions).toHaveText(spare);
});

test("the next quarter's review reads differently", async ({ page }) => {
  await freshRun(page, "/?seed=1&month=6");

  await playUntil(page, "scene-option-restate-last-quarter");

  await expect(page.getByTestId("panel-scene").locator("h2")).toHaveText(
    "Quarterly Business Review: Half Year",
  );
});
