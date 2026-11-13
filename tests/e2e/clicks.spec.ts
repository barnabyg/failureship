import { expect, test, type Locator } from "@playwright/test";
import {
  answerAnyNotification,
  answered,
  freshRun,
  happened,
  openInboxIfAny,
  resultPanel,
} from "./play";

/*
 * What reading a result costs: one click, Continue, since a result shows alone,
 * so that the player has one thing in front of them at a time.
 */

test("plainly playing month 7 on seed 2 takes at most 13 clicks to its official story", async ({
  page,
}) => {
  await freshRun(page, "/?seed=2&month=7");
  let clicks = 0;
  const click = async (target: Locator) => {
    await target.click();
    clicks += 1;
  };
  await openInboxIfAny(page);
  const notification = page.getByTestId("panel-notification");
  const result = resultPanel(page);
  const carryOn = page.getByTestId("continue");
  const story = page.getByTestId("panel-story");
  const meeting = page.locator('[data-testid^="hotspot-meeting"]:enabled');
  const desk = page.locator('[data-testid="hotspot-work"]:enabled');
  const subject = notification.locator("h2");

  // Files the report and says no to the rest, as the later-month start does.
  while (await notification.isVisible()) {
    const before = await subject.innerText();
    const report = page.getByTestId("option-report");
    const free = notification.locator("button:enabled", {
      hasText: "Costs nothing",
    });
    await click((await report.isVisible()) ? report : free.first());
    await expect(notification.locator("h2", { hasText: before })).toHaveCount(
      0,
    );
    if (await result.isVisible()) await click(result.getByTestId("continue"));
  }
  await click(meeting);
  await click(page.locator('[data-testid^="scene-option-"]').first());
  await expect(happened(page)).toBeVisible();
  await click(result.getByTestId("continue"));
  await click(desk);
  await expect(happened(page)).toContainText("Your desk");
  while (!(await story.isVisible())) {
    await expect(carryOn.or(story).first()).toBeVisible();
    if (await carryOn.isVisible()) await click(carryOn);
  }

  expect(clicks).toBeLessThanOrEqual(13);
});

test("shows an answer's result alone, with the floor waiting, until Continue, even over a reload", async ({
  page,
}) => {
  await freshRun(page, "/?seed=2&month=7");
  const count = page.getByTestId("open-inbox");
  const result = resultPanel(page);

  await expect(count).toHaveText("4 to answer");
  await openInboxIfAny(page);
  await page
    .getByTestId("panel-notification")
    .locator('[data-testid^="option-"]:enabled')
    .first()
    .click();

  await expect(answered(page)).toContainText("You answered");
  await expect(page.getByTestId("answer-result")).not.toBeEmpty();
  await expect(count).toHaveText("3 to answer");
  await expect(page.locator("section.panel")).toHaveCount(1);
  await expect(page.getByTestId("stage")).toHaveAttribute(
    "data-floor",
    "waiting",
  );
  await expect(page.getByTestId("hint")).toHaveText(
    "Read what came of it, then press Continue.",
  );

  await page.reload();
  await expect(answered(page)).toBeVisible();

  await result.getByTestId("continue").click();
  await expect(result).toHaveCount(0);
  await expect(page.getByTestId("inbox-item").first()).toBeVisible();
});

test("shows what happened at a place alone, and frees the floor on Continue", async ({
  page,
}) => {
  await freshRun(page, "/?seed=2&month=7");
  await answerAnyNotification(page);

  await page.locator('[data-testid="hotspot-work"]:enabled').click();

  const card = resultPanel(page);
  await expect(card).toContainText("What happened");
  await expect(card).toContainText("Your desk");
  await expect(page.getByTestId("result-spent")).toContainText(
    "That action is spent",
  );
  await expect(page.locator("section.panel")).toHaveCount(1);
  await expect(page.locator('[data-testid^="hotspot-meeting"]')).toBeDisabled();

  await card.getByTestId("continue").click();

  await expect(card).toHaveCount(0);
  await page.locator('[data-testid^="hotspot-meeting"]').click();
  await expect(page.getByTestId("panel-scene")).toBeVisible();
});
