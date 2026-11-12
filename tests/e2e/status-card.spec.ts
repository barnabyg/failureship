import { expect, test, type Page } from "@playwright/test";
import {
  answerAnyNotification,
  freshRun,
  openInboxIfAny,
  playToResults,
  playUntil,
} from "./play";

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

for (const size of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`at ${String(size.width)}×${String(size.height)} no place's label is under the status card or the guide`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    // Floor 1, then Floors 2 and 3 as screen-size.spec.ts reaches them.
    for (const address of [
      "/?seed=5",
      "/?seed=16&month=11&choose=take-the-blame,screenshot-on-the-note,claim-the-credit,word-with-the-analyst",
      "/?seed=24&month=14&choose=take-the-blame,screenshot-on-the-note,claim-the-credit,word-with-the-analyst,staff-the-centre",
    ]) {
      await freshRun(page, address);
      await answerAnyNotification(page);
      await expect(page.locator(".hotspot:enabled").first()).toBeVisible();
      await expectLabelsClear(page);
    }
  });
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`at ${String(size.width)}×${String(size.height)} what happened at a place sits clear of the guide and the labels`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await freshRun(page, "/?seed=5");
    await answerAnyNotification(page);
    await page.locator('[data-testid="hotspot-work"]:enabled').click();

    const card = await page.getByTestId("panel-result").boundingBox();
    const guide = await page.locator(".next").boundingBox();
    if (!card || !guide) throw new Error("Nothing to measure.");
    expect(overlaps(card, guide), "the card is over the guide").toBe(false);
    await expectLabelsClear(page);
    for (const label of await page
      .locator('[data-testid^="hotspot-"], [data-testid^="room-sign-"]')
      .all()) {
      const box = await label.boundingBox();
      if (!box) continue;
      const name = (await label.getAttribute("data-testid")) ?? "";
      expect(overlaps(box, card), `${name} is under the card`).toBe(false);
    }
  });
}

test("one compact status card, with a Grand Plan and an open Demand, each part opening its panel", async ({
  page,
}) => {
  await freshRun(page, "/?seed=1&month=4");
  await playUntil(page, "option-stall");
  await openInboxIfAny(page);
  await page.getByTestId("option-stall").click();

  const card = page.getByTestId("status-card");
  await expect(page.getByTestId("grand-plan-card")).toBeVisible();
  await expect(page.getByTestId("open-demands")).toContainText("1");
  await expect(page.getByTestId("standing-card")).toBeVisible();
  const box = await card.boundingBox();
  if (!box) throw new Error("No card to measure.");
  expect(box.height).toBeLessThanOrEqual(120);

  for (const [part, panel, close] of [
    ["open-project", "project", "close-project"],
    ["grand-plan-card", "grand-plan", "close-project"],
    ["open-demands", "open-demand", "close-project"],
    ["open-word", "word", "close-word"],
  ] as const) {
    await page.getByTestId(part).click();
    await expect(page.getByTestId(panel).first(), part).toBeVisible();
    await page.getByTestId(close).click();
  }
});

test("the goal is said in full in month 1 only, and after that in the guide's tooltip", async ({
  page,
}) => {
  await freshRun(page, "/?seed=1");
  await expect(page.getByTestId("goal")).toBeVisible();

  await freshRun(page, "/?seed=1&month=2");
  await expect(page.getByTestId("hint")).not.toBeEmpty();
  await expect(page.getByTestId("goal")).toHaveCount(0);
  await expect(page.locator(".next")).toHaveAttribute(
    "title",
    /get promoted, seat by seat/,
  );
});

test("the results screen has no status card and no Actions in the header", async ({
  page,
}) => {
  await freshRun(page, "/?seed=1&month=9&last=9");
  await playToResults(page);

  await expect(page.getByTestId("status-card")).toHaveCount(0);
  await expect(page.getByTestId("open-project")).toHaveCount(0);
  await expect(page.getByTestId("actions-left")).toHaveCount(0);
  await expect(page.getByTestId("month")).toBeVisible();
  await expect(page.getByTestId("run-menu")).toBeVisible();
});
