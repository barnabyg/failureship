import { expect, test, type Locator } from "@playwright/test";
import { playUntil } from "./play";

/** Where a line starts down the page. */
async function topOf(line: Locator) {
  const box = await line.boundingBox();
  if (!box) throw new Error("The line is not on screen.");
  return box.y;
}

// The report is filed in month 2 as playUntil plays, so the newsletter says so,
// and what actually happened to it sits beside it on the same row.
for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1280, height: 800 },
]) {
  test(`sets each reported line beside what actually happened, at ${String(viewport.width)} px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/?seed=5&month=2");
    await playUntil(page, "panel-story");

    const row = page
      .getByTestId("story-pair")
      .filter({ hasText: "The Monthly Status Report was delivered" });
    await expect(row).toHaveCount(1);
    const reported = row.getByTestId("story-reported");
    const happened = row.getByTestId("story-happened");
    await expect(happened).toHaveText(
      "You filed it at 23:58. Nobody has opened it.",
    );
    expect(await topOf(happened)).toBeCloseTo(await topOf(reported), -1);

    // A line nobody reported, or a report with nothing behind it, leaves its other side empty.
    for (const pair of await page.getByTestId("story-pair").all()) {
      const sides =
        (await pair.getByTestId("story-reported").count()) +
        (await pair.getByTestId("story-happened").count());
      expect(sides).toBeGreaterThan(0);
    }
  });
}
