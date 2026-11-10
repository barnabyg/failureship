import { expect, test } from "@playwright/test";
import { answered, happened, playUntil } from "./play";

// tests/engine/promises.test.ts keeps this seed true: the Senior Analyst believes it
// in month 3, it falls due in month 5, and by month 6 your boss has heard that it
// never happened. The later tests' start makes the Promise as the first test does.
test("a Promise is made, and is in Your word given", async ({ page }) => {
  await page.goto("/?seed=24&month=3");
  await expect(page.getByTestId("open-word")).toContainText("Your word given");
  await expect(page.getByTestId("word-count")).toHaveText("0 so far");
  await page.getByTestId("open-word").click();
  await expect(page.getByTestId("word")).toContainText("promised nobody");
  await page.getByTestId("close-word").click();

  await playUntil(page, "option-promise-laptops-analyst");
  await page.getByTestId("option-promise-laptops-analyst").click();
  await expect(answered(page)).toContainText("laptops");
  await expect(page.getByTestId("word-count")).toContainText("1");
});

test("a Promise is broken, and the next one is not believed", async ({
  page,
}) => {
  await page.goto("/?seed=24&month=5&choose=promise-laptops-analyst");
  await expect(page.getByTestId("word-count")).toContainText("1");

  await playUntil(page, "option-next-quarter");
  await page.getByTestId("option-next-quarter").click();

  await playUntil(page, "scene-option-promise-laptops");
  await page.getByTestId("scene-option-promise-laptops").click();

  await expect(happened(page)).toContainText("new laptops for their team");
  await page.getByTestId("open-word").click();
  await expect(page.getByTestId("word-promise")).toHaveCount(2);
  await expect(page.getByTestId("word-promise").nth(1)).toContainText(
    "did not believe you",
  );
  await page.getByTestId("close-word").click();
});

// The same run, with the start making the choices the test above makes, since who
// heard shows only on the results screen.
test("the results say a Promise was broken, and who heard", async ({
  page,
}) => {
  await page.goto(
    "/?seed=24&month=9&last=9&choose=promise-laptops-analyst,next-quarter,promise-laptops",
  );
  await playUntil(page, "panel-results");
  const rows = page.getByTestId("result-promise");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Broken");
  await expect(rows.first()).toContainText("Who heard:");
});
