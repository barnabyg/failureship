import { expect, test, type Locator, type Page } from "@playwright/test";
import { openInboxIfAny, playUntil } from "./play";

// Seed 2, ended at month 9: a vacancy decided, Rivals, and a long Notebook.
const ENDED_AT_NINE =
  "/?seed=2&month=9&last=9&choose=take-the-blame,screenshot-on-the-note,claim-the-credit,word-with-the-analyst";

// Wins all three seats, Floor 3's as month 15 closes, as in win.spec.ts.
const CLIMB =
  "choose=take-the-blame,screenshot-on-the-note,claim-the-credit,word-with-the-analyst,sign-on-a-door,word-with-the-coordinator-2,draw-swimlanes,claim-it-middle-manager";

async function reachResults(page: Page) {
  await page.goto(ENDED_AT_NINE);
  await playUntil(page, "panel-results");
}

/** Whether all of it can be read in the panel as it opens, without scrolling. */
async function onFirstScreen(page: Page, locator: Locator) {
  const panel = await page.getByTestId("panel-results").boundingBox();
  const box = await locator.boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  if (!panel || !box) return false;
  return (
    box.y >= panel.y &&
    box.y + box.height <= Math.min(height, panel.y + panel.height)
  );
}

test.describe("at 1440×900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const [run, address] of [
    ["ended at month 9", ENDED_AT_NINE],
    ["won, with the longest route", `/?seed=2&month=15&${CLIMB}`],
  ] as const) {
    test(`the first screen is a summary, with Play again: ${run}`, async ({
      page,
    }) => {
      await page.goto(address);
      await playUntil(page, "panel-results");

      for (const id of [
        "results-ending",
        "result-standing",
        "result-vacancies",
        "results-told",
        "results-play-again",
        "results-new-run",
      ]) {
        const part = page.getByTestId(id);
        await expect(part).toBeVisible();
        expect(await onFirstScreen(page, part), id).toBe(true);
      }
      await expect(page.getByTestId("results-told")).toHaveText(
        /^You were told \d+ things; \d+ were false or misleading\.$/,
      );
    });
  }
});

test("the rest folds, and the Notebook's worth starts folded", async ({
  page,
}) => {
  await reachResults(page);

  await expect(page.getByTestId("results-section-vacancies")).toHaveAttribute(
    "open",
  );
  const rivals = page.getByTestId("results-section-rivals");
  await expect(rivals).toHaveAttribute("open");
  await expect(rivals.locator("summary")).toContainText("Dennis Prowse");
  const clues = page.getByTestId("results-section-clues");
  await expect(clues).not.toHaveAttribute("open");
  await expect(page.getByTestId("result-clue").first()).toBeHidden();

  await clues.locator("summary").click();
  const rows = page.getByTestId("result-clue");
  await expect(rows.first()).toBeVisible();
  await expect(rows.first()).toContainText("False or misleading");
  await expect(rows.filter({ hasText: "An automatic reply" })).toHaveCount(1);
  await expect(
    rows
      .filter({ hasText: "An automatic reply" })
      .getByTestId("result-clue-count"),
  ).toHaveText("Told 9 times");
});

test("the floor's places are not labelled once the run is over", async ({
  page,
}) => {
  await reachResults(page);

  await expect(page.locator('[data-testid^="room-sign-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="hotspot-"]')).toHaveCount(0);
});

test("Play this seed again starts the same deal, without asking", async ({
  page,
  browser,
}) => {
  const fresh = await browser.newPage();
  await fresh.goto("/?seed=2");
  await openInboxIfAny(fresh);
  const first =
    (await fresh.getByTestId("panel-notification").textContent()) ?? "";
  await fresh.close();
  await reachResults(page);

  await page.getByTestId("results-play-again").click();

  await expect(page.getByTestId("confirm-leave")).toHaveCount(0);
  await expect(page.getByTestId("panel-results")).toHaveCount(0);
  await expect(page.getByTestId("seed")).toHaveText("2");
  await expect(page).toHaveURL(/seed=2/);
  await expect(page.getByTestId("month")).toContainText("1 of 18");
  await openInboxIfAny(page);
  await expect(page.getByTestId("panel-notification")).toHaveText(first);
});

test("New run starts another deal, without asking", async ({ page }) => {
  await reachResults(page);

  await page.getByTestId("results-new-run").click();

  await expect(page.getByTestId("confirm-leave")).toHaveCount(0);
  await expect(page.getByTestId("panel-results")).toHaveCount(0);
  await expect(page.getByTestId("month")).toContainText("1 of 18");
});
