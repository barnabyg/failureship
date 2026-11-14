import { expect, test, type Page } from "@playwright/test";
import {
  answerAnyNotification,
  freshRun,
  openInboxIfAny,
  readResult,
} from "./play";

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

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box) {
  return !(
    a.x >= b.x + b.width ||
    a.x + a.width <= b.x ||
    a.y >= b.y + b.height ||
    a.y + a.height <= b.y
  );
}

/** No place's label on the floor is under the status card or the guide. */
async function expectLabelsClear(page: Page) {
  const card = await page.getByTestId("status-card").boundingBox();
  const guide = await page.locator(".next").boundingBox();
  if (!card || !guide) throw new Error("Nothing to measure.");
  const labels = page.locator(
    '[data-testid^="hotspot-"], [data-testid^="room-sign-"]',
  );
  expect(await labels.count()).toBeGreaterThan(0);
  for (const label of await labels.all()) {
    const box = await label.boundingBox();
    if (!box) continue;
    const name = (await label.getAttribute("data-testid")) ?? "";
    expect(overlaps(box, card), `${name} is under the status card`).toBe(false);
    expect(overlaps(box, guide), `${name} is under the guide`).toBe(false);
  }
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
      "run-menu",
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
});

// Each floor, as its first spare action waits, at each size kept. Floors 2 and 3
// are reached by later-month starts.
const FLOORS = [
  "/?seed=5",
  "/?seed=16&month=11&choose=take-the-blame,screenshot-on-the-note,claim-the-credit,word-with-the-analyst",
  "/?seed=24&month=14&choose=take-the-blame,screenshot-on-the-note,claim-the-credit,word-with-the-analyst,staff-the-centre",
];

for (const size of [
  FULL_HD,
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`at ${String(size.width)}×${String(size.height)} every place can be pressed, clear of the status card and the guide, and what follows sits beside them`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    for (const address of FLOORS) {
      await freshRun(page, address);
      await answerAnyNotification(page);
      await expect(page.locator(".hotspot:enabled").first()).toBeVisible();
      await expectReachable(page, await hotspotIds(page));
      await expectLabelsClear(page);
    }

    // Back on Floor 1, what happened at a place leaves the guide readable.
    await freshRun(page, FLOORS[0] ?? "");
    await answerAnyNotification(page);
    await page.locator('[data-testid="hotspot-work"]:enabled').click();
    const result = await page.getByTestId("panel-result").boundingBox();
    const guide = await page.locator(".next").boundingBox();
    if (!result || !guide) throw new Error("Nothing to measure.");
    expect(overlaps(result, guide), "the card is over the guide").toBe(false);
    await readResult(page);

    // The Scene sits beside the cards, not over them.
    await page.getByTestId("hotspot-meeting").click();
    const scene = await page.getByTestId("panel-scene").boundingBox();
    const cards = await page.locator(".top-left").boundingBox();
    if (!scene || !cards) throw new Error("Nothing to measure.");
    expect(scene.x).toBeGreaterThanOrEqual(cards.x + cards.width);
  });
}

/**
 * Whether the tagline is on its one line, and if so whether all of it fits.
 * Pushed on to the hidden second line, it is not shown at all.
 */
async function tagline(page: Page) {
  return page.locator(".tagline").evaluate((line) => {
    const box = line.getBoundingClientRect();
    const words = line.querySelector("span")?.getBoundingClientRect();
    if (!words || box.height === 0) return { shown: false, whole: true };
    const shown = words.top < box.bottom;
    return { shown, whole: !shown || words.right <= box.right + 0.5 };
  });
}

test("the tagline is shown whole on a wide screen, and never cut off", async ({
  page,
}) => {
  await page.setViewportSize(FULL_HD);
  await freshRun(page, "/?seed=5");
  expect(await tagline(page)).toEqual({ shown: true, whole: true });

  // A busy header, with Buzzwords learned, at the narrowest width.
  await page.setViewportSize({ width: 1280, height: 720 });
  await freshRun(page, "/?seed=1");
  await openInboxIfAny(page);
  await page.getByTestId("option-pub").click();
  await expect(page.getByTestId("buzzwords")).toBeVisible();
  expect((await tagline(page)).whole).toBe(true);
});

test("each Gauge says what it is, and looks like a button when pointed at", async ({
  page,
}) => {
  await freshRun(page, "/?seed=5");
  await answerAnyNotification(page);
  const teflon = page.getByTestId("open-gauge-teflon");
  await expect(teflon).toHaveAttribute("title", /blame/);
  await expect(page.getByTestId("open-gauge-fawning")).toHaveAttribute(
    "title",
    /sucking up/,
  );
  const plain = await teflon.evaluate(
    (b) => getComputedStyle(b).backgroundColor,
  );
  await teflon.hover();
  await expect
    .poll(() => teflon.evaluate((b) => getComputedStyle(b).backgroundColor))
    .not.toBe(plain);
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
