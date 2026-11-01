import { expect, test, type Page } from "@playwright/test";
import { answerAnyNotification, attendAndFinishMonth } from "./play";

async function savedText(page: Page) {
  return page.evaluate(() => window.localStorage.getItem("failureship.run"));
}

test("a reload carries on where the player left off", async ({ page }) => {
  await page.goto("/?seed=4");
  await answerAnyNotification(page);
  await attendAndFinishMonth(page);
  await page.getByTestId("option-skip-training").click();
  await page.getByTestId("continue").click();
  // The Demand from your boss's boss, stalled, so that it stays open.
  await page.getByTestId("option-stall").click();
  await page.getByTestId("continue").click();
  await answerAnyNotification(page);
  await page.getByTestId("hotspot-kitchen").click();
  await page.getByTestId("continue").click();
  await page.getByTestId("open-notebook").click();
  await page.getByTestId("mark-boss").selectOption("practitioner");
  await page.getByTestId("close-notebook").click();

  const before = {
    month: await page.getByTestId("month").innerText(),
    actions: await page.getByTestId("actions-left").innerText(),
    real: await page.getByTestId("card-real").innerText(),
    reported: await page.getByTestId("card-reported").innerText(),
    demands: await page.getByTestId("open-demands").innerText(),
  };

  await page.reload();

  expect({
    month: await page.getByTestId("month").innerText(),
    actions: await page.getByTestId("actions-left").innerText(),
    real: await page.getByTestId("card-real").innerText(),
    reported: await page.getByTestId("card-reported").innerText(),
    demands: await page.getByTestId("open-demands").innerText(),
  }).toEqual(before);
  await expect(page.getByTestId("seed")).toHaveText("4");
  await page.getByTestId("open-notebook").click();
  await expect(page.getByTestId("mark-boss")).toHaveValue("practitioner");
  await page.getByTestId("close-notebook").click();
});

test("a reload in the middle of a Scene shows the same Scene", async ({
  page,
}) => {
  await page.goto("/?seed=8");
  await answerAnyNotification(page);
  await page.getByTestId("hotspot-meeting").click();
  const scene = await page.getByTestId("panel-scene").innerText();

  await page.reload();

  expect(await page.getByTestId("panel-scene").innerText()).toBe(scene);
});

test("an address with no seed comes back to the saved run", async ({
  page,
}) => {
  await page.goto("/?seed=8");
  await answerAnyNotification(page);

  await page.goto("/");

  await expect(page.getByTestId("seed")).toHaveText("8");
  await expect(page.getByTestId("panel-notification")).toHaveCount(0);
});

test("new run and restart from seed replace the saved run", async ({
  page,
}) => {
  await page.goto("/?seed=8");
  await answerAnyNotification(page);

  await page.getByTestId("seed-input").fill("5");
  await page.getByTestId("restart-seed").click();
  await page.getByTestId("confirm-leave-yes").click();
  await page.reload();
  await expect(page.getByTestId("seed")).toHaveText("5");
  await expect(page.getByTestId("panel-notification")).toBeVisible();

  await page.getByTestId("new-run").click();
  await page.getByTestId("confirm-leave-yes").click();
  const seed = await page.getByTestId("seed").innerText();
  expect(seed).not.toBe("5");
  await page.reload();
  await expect(page.getByTestId("seed")).toHaveText(seed);
});

test("declining to leave keeps the saved run", async ({ page }) => {
  await page.goto("/?seed=8");
  await answerAnyNotification(page);
  const saved = await savedText(page);

  await page.getByTestId("new-run").click();
  await page.getByTestId("confirm-leave-no").click();

  expect(await savedText(page)).toBe(saved);
});

for (const { what, broken } of [
  { what: "old", broken: '{"version":0,"content":"x","state":{}}' },
  { what: "unreadable", broken: "not a save" },
]) {
  test(`a save that is ${what} offers to start again`, async ({ page }) => {
    await page.goto("/?seed=8");
    await page.evaluate((text) => {
      window.localStorage.setItem("failureship.run", text);
    }, broken);

    await page.reload();

    await expect(page.getByTestId("save-lost")).toBeVisible();
    await page.getByTestId("save-lost-start-again").click();
    await expect(page.getByTestId("save-lost")).toHaveCount(0);
    await expect(page.getByTestId("month")).toContainText("1 of 9");
    await expect(page.getByTestId("panel-notification")).toBeVisible();
    await expect(page.getByTestId("seed")).toHaveText("8");
  });
}
