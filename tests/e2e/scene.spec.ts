import { expect, test, type Page } from "@playwright/test";

async function expectToSayWhatIsNext(page: Page) {
  await expect(page.getByTestId("hint")).not.toBeEmpty();
  await expect(page.locator("body")).not.toContainText(/placeholder/i);
}

async function reachMeeting(page: Page, answer: "pub" | "report", seed = 1) {
  await page.goto(`/?seed=${String(seed)}`);
  await page.getByTestId(`option-${answer}`).click();
  await page.getByTestId("continue").click();
  await page.getByTestId("hotspot-meeting").click();
}

test("opens the meeting Scene from the tower and makes a choice", async ({
  page,
}) => {
  await reachMeeting(page, "report");

  await expect(page.getByTestId("panel-scene")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("actions-left")).toContainText("1");
  await expect(page.getByTestId("sign")).toHaveCount(3);

  await page.getByTestId("scene-option-say-nothing").click();

  await expect(page.getByTestId("panel-notice")).toBeVisible();
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("hotspot-meeting")).toBeDisabled();
  await expect(page.getByTestId("hotspot-kitchen")).toBeEnabled();
});

test("the same choice lands differently when someone else holds influence", async ({
  page,
}) => {
  const resultOnSeed = async (seed: number) => {
    await reachMeeting(page, "report", seed);
    await page.getByTestId("scene-option-back-boss").click();
    return page.getByTestId("panel-notice").innerText();
  };

  expect(await resultOnSeed(1)).not.toEqual(await resultOnSeed(8));
});

test("the full month reads differently for different choices", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await expectToSayWhatIsNext(page);
  await page.getByTestId("option-pub").click();
  await expectToSayWhatIsNext(page);
  await page.getByTestId("continue").click();
  await expectToSayWhatIsNext(page);
  await page.getByTestId("hotspot-meeting").click();
  await expectToSayWhatIsNext(page);
  await page.getByTestId("scene-option-use-buzzword").click();
  await expectToSayWhatIsNext(page);
  await page.getByTestId("continue").click();
  await page.getByTestId("hotspot-kitchen").click();
  await expectToSayWhatIsNext(page);
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("panel-move")).toBeVisible();
  await expectToSayWhatIsNext(page);
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("panel-story")).toBeVisible();
  await expectToSayWhatIsNext(page);
  const afterPub = await page.getByTestId("story-reported").innerText();
  await expect(page.getByTestId("story-happened")).toBeVisible();

  await page.goto("/?seed=1");
  await page.getByTestId("option-report").click();
  await page.getByTestId("continue").click();
  await page.getByTestId("hotspot-meeting").click();
  await expect(page.getByTestId("panel-scene")).not.toContainText(
    "strategic patience",
  );
  await page.getByTestId("scene-option-say-nothing").click();
  await page.getByTestId("continue").click();
  await page.getByTestId("hotspot-kitchen").click();
  await page.getByTestId("continue").click();
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("story-reported")).not.toHaveText(afterPub);
});

test("the report leaves no Buzzword option in the meeting", async ({
  page,
}) => {
  await reachMeeting(page, "report");

  await expect(page.getByTestId("panel-scene")).toBeVisible();
  await expect(page.getByTestId("scene-option-use-buzzword")).toHaveCount(0);
});

test("the pub, then the meeting, then using the Buzzword", async ({ page }) => {
  await reachMeeting(page, "pub");

  await page.getByTestId("scene-option-use-buzzword").click();

  await expect(page.getByTestId("panel-notice")).toBeVisible();
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("hotspot-meeting")).toBeDisabled();
});

test("every Scene choice is visible without scrolling at 1280x800", async ({
  page,
}) => {
  await reachMeeting(page, "pub");

  await expect(page.getByTestId("scene-option-say-nothing")).toBeInViewport({
    ratio: 1,
  });
  const panel = page.getByTestId("panel-scene");
  const scrolls = await panel.evaluate(
    (el) => el.scrollHeight > el.clientHeight,
  );
  expect(scrolls).toBe(false);
});
