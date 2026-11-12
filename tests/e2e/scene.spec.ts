import { expect, test, type Page } from "@playwright/test";
import {
  answerAnyNotification,
  freshRun,
  happened,
  openMeeting,
  skipTheReport,
} from "./play";

async function expectToSayWhatIsNext(page: Page) {
  await expect(page.getByTestId("hint")).not.toBeEmpty();
  await expect(page.locator("body")).not.toContainText(/placeholder/i);
}

async function reachMeeting(page: Page, answer: "pub" | "report", seed = 1) {
  await page.goto(`/?seed=${String(seed)}`);
  if (answer === "pub") {
    await page.getByTestId("option-pub").click();
    await skipTheReport(page);
  } else {
    await answerAnyNotification(page);
  }
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

  await expect(happened(page)).toBeVisible();
  await expect(page.getByTestId("hotspot-meeting")).toBeDisabled();
  await expect(page.getByTestId("hotspot-kitchen")).toBeEnabled();
});

test("the Scene leaves the hint readable at 1280x800", async ({ page }) => {
  await reachMeeting(page, "pub");

  const panel = await page.getByTestId("panel-scene").boundingBox();
  const hint = await page.locator(".next").boundingBox();
  if (!panel || !hint) throw new Error("Nothing to measure.");

  expect(hint.x + hint.width).toBeLessThanOrEqual(panel.x);
});

test("the meeting shows a dealt sign for each person present", async ({
  page,
}) => {
  await reachMeeting(page, "report");

  const signs = page.getByTestId("behaviour");
  await expect(signs).toHaveCount(6);
  const boss = page
    .getByTestId("person")
    .filter({ has: page.getByTestId("treatment") });
  await expect(boss.getByTestId("behaviour")).toHaveCount(1);
  await expect(signs.filter({ hasText: "{who}" })).toHaveCount(0);
});

/** What the person with this job title was seen doing, in their own row. */
function behaviourOf(page: Page, title: RegExp) {
  return page
    .getByTestId("person")
    .filter({ has: page.locator("strong", { hasText: title }) })
    .getByTestId("behaviour");
}

// The real-content test keeps these signs true of seeds 58 and 57.
test("a Scene shows behaviour that belongs to a role", async ({ page }) => {
  await reachMeeting(page, "report", 58);
  await expect(behaviourOf(page, /^Team Leader/)).toContainText(
    "Overruns, then schedules another meeting.",
  );

  await freshRun(page, "/?seed=57");
  await answerAnyNotification(page);
  await page.getByTestId("hotspot-meeting").click();
  await expect(behaviourOf(page, /^Project Co-ordinator$/)).toContainText(
    "Closes, then reopens, late tasks.",
  );
});

test("the same choice lands differently when someone else holds influence", async ({
  page,
}) => {
  const resultOnSeed = async (seed: number) => {
    await reachMeeting(page, "report", seed);
    await page.getByTestId("scene-option-back-boss").click();
    return page.getByTestId("result-body").innerText();
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
  await skipTheReport(page);
  await expectToSayWhatIsNext(page);
  await page.getByTestId("hotspot-meeting").click();
  await expectToSayWhatIsNext(page);
  await page.getByTestId("scene-option-use-buzzword").click();
  await expectToSayWhatIsNext(page);
  await page.getByTestId("hotspot-kitchen").click();

  await expect(page.getByTestId("panel-move")).toBeVisible();
  await expectToSayWhatIsNext(page);
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("panel-story")).toBeVisible();
  await expectToSayWhatIsNext(page);
  const afterPub = await page.getByTestId("story-reported").allInnerTexts();
  await expect(page.getByTestId("story-happened").first()).toBeVisible();

  await freshRun(page, "/?seed=1");
  await answerAnyNotification(page);
  await page.getByTestId("hotspot-meeting").click();
  await expect(page.getByTestId("panel-scene")).not.toContainText(
    "strategic patience",
  );
  await page.getByTestId("scene-option-say-nothing").click();
  await page.getByTestId("hotspot-kitchen").click();
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

  await expect(happened(page)).toBeVisible();
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

test("each Character's row holds what they were seen doing", async ({
  page,
}) => {
  await reachMeeting(page, "report", 5);

  const rows = page.getByTestId("person");
  await expect(rows).toHaveCount(6);
  await expect(page.getByTestId("behaviour")).toHaveCount(6);
  // Only a Senior Analyst can rework the figures, and how they are with you
  // is folded into the same line.
  const analyst = behaviourOf(page, /^Senior Analyst$/);
  await expect(analyst).toHaveText(
    "Circulates corrected figures to everyone. Checks your reaction first.",
  );
  await expect(analyst.getByTestId("regard")).toHaveText(
    "Checks your reaction first.",
  );
  // The bosses come first, and say on a line of their own how they are with you.
  await expect(rows.nth(0).getByTestId("head-treatment")).toHaveCount(1);
  await expect(rows.nth(1).getByTestId("treatment")).toHaveCount(1);
});

// The Recruitment Panel has the most people in a Floor 1 meeting, and was the longest read.
test("a meeting's people and choices fit without scrolling at 1600x900", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await freshRun(page, "/?seed=2&month=7");
  await answerAnyNotification(page);
  await openMeeting(page);

  const panel = page.getByTestId("panel-scene");
  await expect(panel).toContainText("Recruitment Panel");
  const rows = page.getByTestId("person");
  expect(await rows.count()).toBeGreaterThan(4);
  for (const row of await rows.all()) {
    await expect(row).toBeInViewport({ ratio: 1 });
  }
  const options = page.locator('[data-testid^="scene-option-"]');
  for (const option of await options.all()) {
    await expect(option).toBeInViewport({ ratio: 1 });
  }
  expect(await panel.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    false,
  );
});

for (const [width, height] of [
  [1280, 720],
  [1920, 1080],
] as const) {
  test(`keeps every choice in view, in text of 15 px or more, at ${String(width)}x${String(height)}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await reachMeeting(page, "report", 5);

    const options = page.locator('[data-testid^="scene-option-"]');
    expect(await options.count()).toBeGreaterThan(1);
    for (const option of await options.all()) {
      await expect(option).toBeInViewport({ ratio: 1 });
    }
    const panel = page.getByTestId("panel-scene");
    expect(
      await panel.evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBe(false);
    const sizes = await panel
      .locator(
        '[data-testid="behaviour"], [data-testid="sign"], [data-testid^="scene-option-"]',
      )
      .evaluateAll((els) =>
        els.map((el) => parseFloat(getComputedStyle(el).fontSize)),
      );
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(15);
  });
}
