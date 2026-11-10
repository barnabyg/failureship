import { expect, test } from "@playwright/test";
import { freshRun, happened, playToResults, playUntil } from "./play";

// "the game's Rivals" in tests/engine/rivals.test.ts keeps these seeds true: on
// seed 39 a Rival's false story about your project lands in month 1, and by month
// 8 you have the means to tell one yourself. On seed 22 nobody tells one.
test("a Rival's Move lands on you, and later you can make the same Move", async ({
  page,
}) => {
  await page.goto("/?seed=39");
  const moved = page.getByTestId("panel-move");
  await playUntil(page, "panel-move");
  await expect(moved).toContainText("Your project is apparently in trouble");
  // The player is never told who is a Rival, only what happened.
  await expect(page.locator("main")).not.toContainText(/\brivals?\b/i);

  await freshRun(page, "/?seed=39&month=8&last=9");
  await playUntil(page, "scene-option-start-a-rumour");
  await page.getByTestId("scene-option-start-a-rumour").click();
  await expect(happened(page)).toContainText("come back to you");

  await playToResults(page);
  // Yours is the same Move as theirs: a false story that travels, from whoever you told.
  await expect(
    page
      .getByTestId("result-belief")
      .filter({ hasText: "the Project Co-ordinator's project was in trouble" })
      .filter({ hasText: /heard it from you\./ }),
  ).toHaveCount(1);
  const rivals = page.getByTestId("results-rivals");
  await expect(rivals).toContainText("Your project is apparently in trouble");
  await expect(rivals).toContainText("Attack");
});

test("without having seen it done, the same Move is not on offer", async ({
  page,
}) => {
  await page.goto("/?seed=22&month=8");
  await playUntil(page, "scene-option-take-a-biscuit");

  await expect(page.getByTestId("panel-scene")).toContainText(
    "Speak Up Listening Session",
  );
  await expect(page.getByTestId("scene-option-start-a-rumour")).toHaveCount(0);
});
