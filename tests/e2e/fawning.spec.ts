import { expect, test } from "@playwright/test";
import { playUntil } from "./play";

// On this seed, handing the arrow to your boss at the first quarterly review comes
// back the month after, and nothing else moves Fawning then. "Fawning > ends the same
// on deals with different Power Maps..." in tests/engine/fawning.test.ts checks the rules.
test("handing your boss the credit comes back on Fawning", async ({ page }) => {
  await page.goto("/?seed=2&month=3");
  const fawning = page.getByTestId("gauge-fawning").locator("dd");
  await expect(page.getByTestId("gauge-fawning")).toBeVisible();
  await playUntil(page, "scene-option-credit-boss");
  await page.getByTestId("scene-option-credit-boss").click();
  await playUntil(page, "panel-story");
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("month")).toContainText("4 of 18");
  const before = Number(await fawning.innerText());

  // Fawning moves as the month closes, and says which Thread moved it.
  await playUntil(page, "panel-story");
  await expect(
    page.getByTestId("story-gauge").filter({ hasText: "Fawning" }),
  ).toContainText("Handing the arrow to your boss");
  await expect(fawning).toHaveText(String(before + 15));
  await page.getByTestId("open-gauge-fawning").click();
  await expect(
    page.getByTestId("gauge-card-fawning").getByTestId("gauge-move").last(),
  ).toContainText("Handing the arrow to your boss");
  await page.getByTestId("close-gauges").click();
});
