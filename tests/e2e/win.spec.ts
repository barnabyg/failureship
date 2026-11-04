import { expect, test } from "@playwright/test";
import { freshRun } from "./play";

test("says the goal on the first screen", async ({ page }) => {
  await freshRun(page, "/?seed=8");

  await expect(page.getByTestId("panel-notification")).toBeVisible();
  await expect(page.getByTestId("goal")).toHaveText(
    "Your goal: climb by reading people, and reach the top of Floor 3.",
  );
});
