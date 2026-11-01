import { expect, test, type Page } from "@playwright/test";
import { finishMonth } from "./play";

async function openProject(page: Page) {
  await page.getByTestId("open-project").click();
  await expect(page.getByTestId("project")).toBeVisible();
}

async function closeProject(page: Page) {
  await page.getByTestId("close-project").click();
  await expect(page.getByTestId("project")).toHaveCount(0);
}

async function reachTheReport(page: Page) {
  await page.getByTestId("option-decline").click();
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("option-report")).toBeVisible();
}

test("lying in the report sets the reported status apart from the real one", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await reachTheReport(page);

  await page.getByTestId("option-report").click();
  await openProject(page);
  await expect(page.getByTestId("project-real")).toHaveText("Amber");
  await expect(page.getByTestId("project-reported")).toHaveText("Amber");
  await closeProject(page);

  await page.goto("/?seed=1");
  await reachTheReport(page);
  await page.getByTestId("option-lie").click();

  await openProject(page);
  await expect(page.getByTestId("project-real")).toHaveText("Amber");
  await expect(page.getByTestId("project-reported")).toHaveText("Green");
  await closeProject(page);
  await page.getByTestId("continue").click();
  await finishMonth(page);

  await expect(page.getByTestId("month")).toContainText("2 of 9");
  await openProject(page);
  await expect(page.getByTestId("project-reported")).toHaveText("Green");
});

test("the Project can be looked at from any step, at no cost", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  const left = (await page.getByTestId("actions-left").textContent()) ?? "";

  await openProject(page);
  await expect(page.getByTestId("project-owner")).toContainText("You");
  await closeProject(page);

  await expect(page.getByTestId("panel-notification")).toBeVisible();
  await expect(page.getByTestId("actions-left")).toHaveText(left);
});

test("doing the work improves the real status, and nothing else", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await reachTheReport(page);
  await page.getByTestId("option-lie").click();
  await page.getByTestId("continue").click();

  await page.getByTestId("hotspot-work").click();

  await openProject(page);
  await expect(page.getByTestId("project-real")).toHaveText("Green");
});

test("the Project sits on the floor, with both statuses in plain view", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  const card = page.getByTestId("open-project");

  await expect(card).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId("card-real")).toHaveText("Amber");
  await expect(page.getByTestId("card-reported")).toHaveText("Green");

  await reachTheReport(page);
  await page.getByTestId("option-report").click();

  await expect(page.getByTestId("card-reported")).toHaveText("Amber");
});

test("the Project card covers nothing on the floor, and nothing covers it in a Scene", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await reachTheReport(page);
  await page.getByTestId("option-report").click();
  await page.getByTestId("continue").click();
  const card = await page.getByTestId("open-project").boundingBox();
  if (!card) throw new Error("No card to measure.");

  for (const other of await page.locator(".hotspot, .status, .next").all()) {
    const box = await other.boundingBox();
    if (!box) continue;
    const apart =
      box.x >= card.x + card.width ||
      box.x + box.width <= card.x ||
      box.y >= card.y + card.height ||
      box.y + box.height <= card.y;
    expect(apart, await other.innerText()).toBe(true);
  }

  await page.getByTestId("hotspot-meeting").click();
  const panel = await page.getByTestId("panel-scene").boundingBox();
  if (!panel) throw new Error("No panel to measure.");
  expect(card.x + card.width).toBeLessThanOrEqual(panel.x);
  await page.getByTestId("open-project").click();
  await expect(page.getByTestId("project")).toBeVisible();
});
