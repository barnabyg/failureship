import { expect, test, type Page } from "@playwright/test";
import { answerAnyNotification, playToResults } from "./play";

async function openNotebook(page: Page) {
  await page.getByTestId("open-notebook").click();
  await expect(page.getByTestId("notebook")).toBeVisible();
}

async function closeNotebook(page: Page) {
  await page.getByTestId("close-notebook").click();
  await expect(page.getByTestId("notebook")).toHaveCount(0);
}

test("a clue arrives, a Character is marked, and the mark is on the results screen", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await openNotebook(page);
  await expect(page.getByTestId("clue")).toHaveCount(0);
  await closeNotebook(page);

  await answerAnyNotification(page);
  await page.getByTestId("hotspot-ask-around").click();
  await page.getByTestId("source-analyst").click();
  await page.getByTestId("subject-boss").click();
  const claim = await page.getByTestId("claim-text").innerText();

  await openNotebook(page);
  const clue = page.getByTestId("clue").filter({ hasText: claim });
  await expect(clue).toContainText("Priya Venn");
  await expect(clue).toContainText("Month 1");
  await page.getByTestId("mark-boss").selectOption("practitioner");
  await closeNotebook(page);

  await page.getByTestId("continue").click();
  await playToResults(page);

  const row = page.getByTestId("result-mark").filter({ hasText: "Dennis" });
  await expect(row).toContainText("Practitioner");
  await expect(page.getByTestId("result-clue").first()).toBeVisible();
});

test("the Notebook opens from every step of a month", async ({ page }) => {
  const opensAndCloses = async (panel: string) => {
    const left = (await page.getByTestId("actions-left").textContent()) ?? "";
    await openNotebook(page);
    await closeNotebook(page);
    await expect(page.getByTestId(panel)).toBeVisible();
    await expect(page.getByTestId("actions-left")).toHaveText(left);
  };

  await page.goto("/?seed=1");
  await opensAndCloses("panel-notification");
  await page.getByTestId("option-pub").click();
  await opensAndCloses("panel-dialog");
  await page.getByTestId("continue").click();
  await page.getByTestId("hotspot-ask-around").click();
  await opensAndCloses("panel-find-out");
  await page.getByTestId("source-analyst").click();
  await page.getByTestId("subject-boss").click();
  await opensAndCloses("panel-claim");
  await page.getByTestId("continue").click();
  await page.getByTestId("hotspot-meeting").click();
  await opensAndCloses("panel-scene");
  await page.getByTestId("scene-option-say-nothing").click();
  await opensAndCloses("panel-notice");
  await page.getByTestId("continue").click();
  await opensAndCloses("panel-move");
  await page.getByTestId("continue").click();
  await opensAndCloses("panel-story");
});

test("opening the Notebook costs nothing, from any step", async ({ page }) => {
  await page.goto("/?seed=1");
  await openNotebook(page);
  await closeNotebook(page);
  await expect(page.getByTestId("panel-notification")).toBeVisible();

  await answerAnyNotification(page);
  await expect(page.getByTestId("actions-left")).toContainText("2");
  await openNotebook(page);
  await page.getByTestId("mark-head").selectOption("believer");
  await page.getByTestId("mark-head").selectOption("incompetent");
  await page.getByTestId("mark-head").selectOption("");
  await closeNotebook(page);

  await expect(page.getByTestId("actions-left")).toContainText("2");
  await page.getByTestId("hotspot-kitchen").click();
  await expect(page.getByTestId("panel-notice")).toBeVisible();
  await openNotebook(page);
  await closeNotebook(page);
  await expect(page.getByTestId("panel-notice")).toBeVisible();
});

test("escape closes the Notebook, and a mark survives closing it", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await openNotebook(page);
  await page.getByTestId("mark-boss").selectOption("believer");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("notebook")).toHaveCount(0);

  await openNotebook(page);
  await expect(page.getByTestId("mark-boss")).toHaveValue("believer");
});

test("the Notebook can be read but not changed once the run is over", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await playToResults(page);

  await openNotebook(page);

  await expect(page.getByTestId("mark-boss")).toBeDisabled();
});
