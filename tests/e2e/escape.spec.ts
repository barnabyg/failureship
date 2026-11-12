import { expect, test } from "@playwright/test";
import { happened, playUntil } from "./play";

// tests/engine/escapes.test.ts keeps these seeds true. Played plainly, the
// minutes of a meeting come back on the player as a Move: in month 4 on seed 2,
// where the Junior Associate has nothing on them, and in month 5 on seed 1,
// where the Junior Associate plays bridge with the Chief Executive.

test("an Escape that works moves the consequence on, and the story reports it", async ({
  page,
}) => {
  await page.goto("/?seed=2&month=4");
  await playUntil(page, "panel-escape");
  await expect(page.getByTestId("panel-escape")).toContainText(
    "Action: you (from the minutes)",
  );
  await expect(page.getByTestId("escape-minutes-take-it")).toBeVisible();

  await page.getByTestId("escape-minutes-blame-the-associate").click();
  await expect(happened(page)).toContainText("development opportunity");

  await playUntil(page, "panel-story");
  await expect(page.getByTestId("story")).toContainText(
    "The synergy action was reassigned as a development opportunity.",
  );
  await expect(
    page.getByTestId("story-gauge").filter({ hasText: "Teflon +10" }),
  ).toHaveCount(1);
  // The minutes' own cost to Teflon went elsewhere with the consequence.
  await expect(
    page.getByTestId("story-gauge").filter({ hasText: "Teflon -5" }),
  ).toHaveCount(0);
});

test("an Escape that fails is worse, and the results screen says why", async ({
  page,
}) => {
  await page.goto("/?seed=1&month=5&last=5");
  await playUntil(page, "panel-escape");
  await page.getByTestId("escape-minutes-blame-the-associate").click();
  await expect(happened(page)).toContainText("It was you.");

  await playUntil(page, "panel-results");
  const row = page.getByTestId("result-escape");
  await expect(row).toHaveAttribute("data-worked", "false");
  await expect(row).toContainText("It did not work.");
  await expect(row).toContainText("Chief Executive");
});
