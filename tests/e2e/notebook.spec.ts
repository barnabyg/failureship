import { expect, test, type Page } from "@playwright/test";
import {
  answerAnyNotification,
  askAtPhotocopier,
  openInboxIfAny,
  playToResults,
  readResult,
  skipTheReport,
} from "./play";

async function openNotebook(page: Page) {
  await page.getByTestId("open-notebook").click();
  await expect(page.getByTestId("notebook")).toBeVisible();
}

async function closeNotebook(page: Page) {
  await page.getByTestId("close-notebook").click();
  await expect(page.getByTestId("notebook")).toHaveCount(0);
}

test("a clue arrives, and a Character is marked", async ({ page }) => {
  await page.goto("/?seed=1");
  await openNotebook(page);
  await expect(page.getByTestId("clue")).toHaveCount(0);
  await closeNotebook(page);

  await answerAnyNotification(page);
  await askAtPhotocopier(page);
  const claim = await page.getByTestId("claim-text").innerText();
  const title = await page.getByTestId("result-title").innerText();
  const source = title.replace(/ has a word with you$/, "");

  await openNotebook(page);
  const clue = page.getByTestId("clue").filter({ hasText: claim });
  await expect(clue).toContainText(source);
  await expect(
    page.getByTestId("clue-month").filter({ has: clue }),
  ).toContainText("Month 1");
  await page.getByTestId("mark-boss").selectOption("practitioner");
  await closeNotebook(page);
  await openNotebook(page);
  await expect(page.getByTestId("mark-boss")).toHaveValue("practitioner");
});

test("a mark lasts into the next month, and is on the results screen", async ({
  page,
}) => {
  await page.goto("/?seed=1&month=8&last=9");
  await openNotebook(page);
  await page.getByTestId("mark-boss").selectOption("practitioner");
  await closeNotebook(page);

  await playToResults(page);

  const row = page.getByTestId("result-mark").filter({ hasText: "Dennis" });
  await expect(row).toContainText("Practitioner");
  await page.getByTestId("results-section-clues").locator("summary").click();
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
  await opensAndCloses("panel-inbox");
  await openInboxIfAny(page);
  await page.getByTestId("option-pub").click();
  await opensAndCloses("answered");
  await skipTheReport(page);
  await page.getByTestId("hotspot-ask-around").click();
  await opensAndCloses("panel-find-out");
  await page.locator('[data-testid^="subject-"]').first().click();
  await opensAndCloses("panel-result");
  await readResult(page);
  await page.getByTestId("hotspot-meeting").click();
  await opensAndCloses("panel-scene");
  await page.getByTestId("scene-option-say-nothing").click();
  await readResult(page);
  await opensAndCloses("panel-story");
});

test("opening the Notebook costs nothing, from any step", async ({ page }) => {
  await page.goto("/?seed=1");
  await openNotebook(page);
  await closeNotebook(page);
  await openInboxIfAny(page);
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
  await expect(page.getByTestId("panel-result")).toBeVisible();
  await openNotebook(page);
  await closeNotebook(page);
  await expect(page.getByTestId("panel-result")).toBeVisible();
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
  await page.goto("/?seed=1&month=9&last=9");
  await playToResults(page);

  await openNotebook(page);

  await expect(page.getByTestId("mark-boss")).toBeDisabled();
});

test("choosing a person shows only the clues about them, and All shows every one", async ({
  page,
}) => {
  await page.goto("/?seed=2&month=4");
  await openNotebook(page);
  const clues = page.getByTestId("clue");
  const all = await clues.count();
  await expect(page.getByTestId("about-all")).toHaveText(
    `All · ${String(all)}`,
  );

  const person = page.getByTestId("about-head");
  const [title, count] = (await person.innerText()).split(" · ");
  await person.click();

  await expect(person).toHaveAttribute("aria-pressed", "true");
  expect(Number(count)).toBeGreaterThan(0);
  expect(Number(count)).toBeLessThan(all);
  await expect(clues).toHaveCount(Number(count));
  await expect(page.getByTestId("clue-month").first()).toHaveAttribute("open");
  const named = new RegExp(
    `Hugh Lamb|your boss.s boss|${title?.split(",")[0] ?? "-"}`,
    "i",
  );
  for (const text of await clues.allTextContents()) {
    expect(text).toMatch(named);
  }

  await page.getByTestId("about-all").click();
  await expect(clues).toHaveCount(all);
});

test("the header counts the clues new since the Notebook was opened", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  const button = page.getByTestId("open-notebook");
  await expect(button).toHaveText("Notebook (0)");

  await answerAnyNotification(page);
  await openNotebook(page);
  const before = await page.getByTestId("clue").count();
  await closeNotebook(page);
  await expect(button).toHaveText(`Notebook (${String(before)})`);

  await askAtPhotocopier(page);
  await expect(button).toHaveText("Notebook (1 new)");
  await page.reload();
  await expect(button).toHaveText("Notebook (1 new)");

  await openNotebook(page);
  const claim = page.getByTestId("clue").first();
  await expect(claim).toBeVisible();
  await expect(page.getByTestId("clue-new-tag")).toHaveCount(1);
  await expect(claim.getByTestId("clue-new-tag")).toHaveCount(1);
  await closeNotebook(page);
  const after = `Notebook (${String(before + 1)})`;
  await expect(button).toHaveText(after);

  await openNotebook(page);
  await expect(page.getByTestId("clue-new-tag")).toHaveCount(0);
  await closeNotebook(page);
  await page.reload();
  await expect(button).toHaveText(after);
});
