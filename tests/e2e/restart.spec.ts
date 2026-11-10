import { expect, test, type Page } from "@playwright/test";
import { answerAnyNotification, playToResults } from "./play";
import { openRunMenu } from "./run-menu";

async function reachSecondAction(page: Page) {
  await answerAnyNotification(page);
  await page.getByTestId("hotspot-kitchen").click();
}

test("restarts from a typed seed in the middle of a run", async ({ page }) => {
  await page.goto("/?seed=8");
  await answerAnyNotification(page);
  await page.getByTestId("hotspot-meeting").click();
  const signs = await page.getByTestId("panel-scene").innerText();
  await page.getByTestId("scene-option-say-nothing").click();

  await page.goto("/?seed=1");
  await reachSecondAction(page);
  await openRunMenu(page);
  await page.getByTestId("seed-input").fill("8");
  await page.getByTestId("restart-seed").click();

  await expect(page.getByTestId("confirm-leave")).toBeVisible();
  await page.getByTestId("confirm-leave-yes").click();

  await expect(page.getByTestId("seed")).toHaveText("8");
  await expect(page).toHaveURL(/seed=8/);
  await expect(page.getByTestId("month")).toContainText("1 of 18");
  await expect(page.getByTestId("actions-left")).toContainText("3");
  await expect(page.getByTestId("panel-notification")).toBeVisible();

  await answerAnyNotification(page);
  await page.getByTestId("hotspot-meeting").click();
  expect(await page.getByTestId("panel-scene").innerText()).toBe(signs);
});

test("declining the confirmation keeps the run", async ({ page }) => {
  await page.goto("/?seed=1");
  await reachSecondAction(page);

  await openRunMenu(page);
  await page.getByTestId("new-run").click();
  await page.getByTestId("confirm-leave-no").click();

  await expect(page.getByTestId("confirm-leave")).toHaveCount(0);
  await expect(page.getByTestId("seed")).toHaveText("1");
  await expect(page.getByTestId("actions-left")).toContainText("1");
});

test("escape also keeps the run", async ({ page }) => {
  await page.goto("/?seed=1");
  await reachSecondAction(page);

  await openRunMenu(page);
  await page.getByTestId("new-run").click();
  await expect(page.getByTestId("confirm-leave")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("confirm-leave")).toHaveCount(0);
  await expect(page.getByTestId("actions-left")).toContainText("1");
});

test("a new run deals a new seed from any step", async ({ page }) => {
  await page.goto("/?seed=1");
  await page.getByTestId("option-pub").click();

  await openRunMenu(page);
  await page.getByTestId("new-run").click();
  await page.getByTestId("confirm-leave-yes").click();

  await expect(page.getByTestId("seed")).not.toHaveText("1");
  await expect(page.getByTestId("buzzwords")).toHaveCount(0);
  await expect(page.getByTestId("panel-notification")).toBeVisible();
});

test("a seed that cannot be used is refused and the run carries on", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await reachSecondAction(page);

  await openRunMenu(page);
  await page.getByTestId("seed-input").fill("not a seed");
  await page.getByTestId("seed-input").press("Enter");

  await expect(page.getByTestId("seed-message")).toContainText("not a seed");
  await expect(page.getByTestId("confirm-leave")).toHaveCount(0);
  await expect(page.getByTestId("seed")).toHaveText("1");
  await expect(page.getByTestId("actions-left")).toContainText("1");
});

test("an address with no seed gets the seed on screen", async ({ page }) => {
  await page.goto("/");

  const seed = await page.getByTestId("seed").innerText();

  await expect(page).toHaveURL(new RegExp(`seed=${seed}$`));
});

test("an address with a seed that cannot be used says so", async ({ page }) => {
  await page.goto("/?seed=banana");

  await expect(page.getByTestId("seed-message")).toContainText("banana");
  await expect(page).toHaveURL(/seed=\d+/);
});

test("the end of a run needs no confirmation to leave", async ({ page }) => {
  await page.goto("/?seed=1&month=9&last=9");
  await playToResults(page);

  await openRunMenu(page);
  await page.getByTestId("seed-input").fill("5");
  await page.getByTestId("restart-seed").click();

  await expect(page.getByTestId("confirm-leave")).toHaveCount(0);
  await expect(page.getByTestId("seed")).toHaveText("5");
  await expect(page.getByTestId("panel-notification")).toBeVisible();
});

test("the Run menu holds the seed, New run and Restart from seed, and only Org Chart and Notebook sit beside it", async ({
  page,
}) => {
  await page.goto("/?seed=3");
  await answerAnyNotification(page);

  const menu = page.getByTestId("run-menu");
  await expect(menu).toContainText("3");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("new-run")).toHaveCount(0);
  await expect(page.getByTestId("seed-input")).toHaveCount(0);
  const buttons = await page
    .locator(".run-controls button:visible")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
  expect(buttons).toEqual(["open-org-chart", "open-notebook", "run-menu"]);

  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("new-run")).toBeVisible();
  await expect(page.getByTestId("restart-seed")).toBeVisible();

  // A click elsewhere puts it away.
  await page.getByTestId("job-title").click();
  await expect(page.getByTestId("new-run")).toHaveCount(0);
});

test("the Run menu works from the keyboard, and leaving still asks first", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await reachSecondAction(page);

  await page.getByTestId("run-menu").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("new-run")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("new-run")).toHaveCount(0);
  await expect(page.getByTestId("run-menu")).toBeFocused();

  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("new-run")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("seed-input")).toBeFocused();
  await page.keyboard.type("8");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("restart-seed")).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("confirm-leave")).toBeVisible();
  await page.getByTestId("confirm-leave-yes").click();
  await expect(page.getByTestId("seed")).toHaveText("8");
});

test("a new run can be started from the end", async ({ page }) => {
  await page.goto("/?seed=1&month=9");
  await playToResults(page);

  await openRunMenu(page);
  await page.getByTestId("new-run").click();

  await expect(page.getByTestId("seed")).not.toHaveText("1");
  await expect(page.getByTestId("month")).toContainText("1 of 18");
});
