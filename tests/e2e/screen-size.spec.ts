import { expect, test, type Page } from "@playwright/test";
import { answerAnyNotification, freshRun } from "./play";

// The smallest screen the game supports is 1920×1080. A browser there shows
// less than the whole screen, and a laptop that scales its display shows less
// again, so the game is laid out to work down to 1280 px wide, and below that
// says the window is too narrow.
const FULL_HD = { width: 1920, height: 1080 };

/** Each element is wholly on screen, and nothing else is drawn over its middle. */
async function expectReachable(page: Page, testIds: readonly string[]) {
  for (const id of testIds) {
    const element = page.getByTestId(id);
    await expect(element, id).toBeInViewport({ ratio: 1 });
    const onTop = await element.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const top = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      return top !== null && el.contains(top);
    });
    expect(onTop, `${id} is covered`).toBe(true);
  }
}

/** Every place on the floor, by its label. */
async function hotspotIds(page: Page) {
  const ids = await page
    .locator('[data-testid^="hotspot-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
  return ids.filter((id): id is string => id !== null);
}

test.describe("at 1920×1080", () => {
  test.use({ viewport: FULL_HD });

  test("the header fits, every place can be pressed, and the meeting and Notebook open", async ({
    page,
  }) => {
    await freshRun(page, "/?seed=5");
    await expect(page.getByTestId("too-narrow")).toBeHidden();
    await answerAnyNotification(page);

    await expectReachable(page, [
      "job-title",
      "month",
      "actions-left",
      "new-run",
      "open-org-chart",
      "open-notebook",
    ]);
    const header = page.locator(".status");
    const headerBox = await header.boundingBox();
    if (!headerBox) throw new Error("The header has no position.");
    expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(FULL_HD.width);
    expect(
      await header.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);

    const places = await hotspotIds(page);
    expect(places).toContain("hotspot-meeting");
    await expectReachable(page, places);
    // The lift's sign is read, not pressed, so clicks go through it.
    await expect(page.getByTestId("room-sign-lift")).toBeInViewport({
      ratio: 1,
    });

    await page.getByTestId("hotspot-meeting").click();
    const scene = page.getByTestId("panel-scene");
    await expect(scene).toBeVisible();
    await expect(scene).toBeInViewport({ ratio: 1 });

    await page.locator('[data-testid^="scene-option-"]').first().click();
    await page.getByTestId("open-notebook").click();

    await expect(page.getByTestId("notebook")).toBeVisible();
  });

  for (const [floor, address] of [
    [2, "/?seed=16&month=11&choose=take-the-blame,screenshot-on-the-note"],
    [
      3,
      "/?seed=24&month=14&choose=take-the-blame,screenshot-on-the-note,staff-the-centre",
    ],
  ] as const) {
    test(`every place on Floor ${String(floor)} can be pressed`, async ({
      page,
    }) => {
      await freshRun(page, address);
      await answerAnyNotification(page);
      await expectReachable(page, await hotspotIds(page));
    });
  }
});

test("at 1280 px the Scene sits beside the cards, not over them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await freshRun(page, "/?seed=5");
  await answerAnyNotification(page);
  await page.getByTestId("hotspot-meeting").click();
  const scene = await page.getByTestId("panel-scene").boundingBox();
  const cards = await page.locator(".top-left").boundingBox();
  if (!scene || !cards) throw new Error("Nothing to measure.");
  expect(scene.x).toBeGreaterThanOrEqual(cards.x + cards.width);
});

test("a window narrower than 1280 px says so, and one at 1280 px does not", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1279, height: 800 });
  await freshRun(page, "/?seed=5");
  const tooNarrow = page.getByTestId("too-narrow");
  await expect(tooNarrow).toBeVisible();
  await expect(tooNarrow).toContainText("1280");

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(tooNarrow).toBeHidden();
});
