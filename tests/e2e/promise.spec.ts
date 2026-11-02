import { expect, test } from "@playwright/test";
import { playToResults, playUntil } from "./play";

// tests/engine/promises.test.ts keeps this seed true: the Senior Analyst believes it,
// and by month 6 your boss has heard that it never happened.
test("a Promise is made, broken, and the next one is not believed", async ({
  page,
}) => {
  await page.goto("/?seed=7&month=3");
  await page.getByTestId("open-word").click();
  await expect(page.getByTestId("word")).toContainText("promised nobody");
  await page.getByTestId("close-word").click();

  await playUntil(page, "option-promise-laptops-analyst");
  await page.getByTestId("option-promise-laptops-analyst").click();
  await expect(page.getByTestId("panel-notice")).toContainText("laptops");
  await expect(page.getByTestId("word-count")).toContainText("1");
  await page.getByTestId("continue").click();

  await playUntil(page, "option-next-quarter");
  await page.getByTestId("option-next-quarter").click();
  await page.getByTestId("continue").click();

  await playUntil(page, "scene-option-promise-laptops");
  await page.getByTestId("scene-option-promise-laptops").click();

  await expect(page.getByTestId("panel-notice")).toContainText(
    "new laptops for their team",
  );
  await page.getByTestId("continue").click();
  await page.getByTestId("open-word").click();
  await expect(page.getByTestId("word-promise")).toHaveCount(2);
  await expect(page.getByTestId("word-promise").nth(1)).toContainText(
    "did not believe you",
  );
  await page.getByTestId("close-word").click();

  await playToResults(page);
  const rows = page.getByTestId("result-promise");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Broken");
  await expect(rows.first()).toContainText("Who heard:");
});
