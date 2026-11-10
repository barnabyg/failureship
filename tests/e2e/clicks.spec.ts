import { expect, test, type Locator } from "@playwright/test";
import { answerAnyNotification, answered, freshRun, happened } from "./play";

/*
 * What reading a result costs. A result that nothing else waits on costs no
 * click of its own: it stays beside the next thing, until the player does it.
 */

test("plainly playing month 7 on seed 2 takes at most 10 clicks to its official story", async ({
  page,
}) => {
  await freshRun(page, "/?seed=2&month=7");
  let clicks = 0;
  const click = async (target: Locator) => {
    await target.click();
    clicks += 1;
  };
  const notification = page.getByTestId("panel-notification");
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
    await expect(answered(page)).toBeVisible();
    await expect(notification.locator("h2", { hasText: before })).toHaveCount(
      0,
    );
  }
  await click(meeting);
  await click(page.locator('[data-testid^="scene-option-"]').first());
  await expect(happened(page)).toBeVisible();
  await click(desk);
  await expect(happened(page)).toContainText("Your desk");
  while (!(await story.isVisible())) {
    await expect(carryOn.or(story).first()).toBeVisible();
    if (await carryOn.isVisible()) await click(carryOn);
  }

  expect(clicks).toBeLessThanOrEqual(10);
});

test("says how many e-mails are waiting, and keeps each answer's result in its e-mail", async ({
  page,
}) => {
  await freshRun(page, "/?seed=2&month=7");
  const count = page.getByTestId("inbox-count");

  await expect(count).toHaveText("Inbox: 3 more after this one");
  await page
    .getByTestId("panel-notification")
    .locator("button:enabled")
    .first()
    .click();

  await expect(answered(page)).toContainText("You answered");
  await expect(page.getByTestId("answer-result")).not.toBeEmpty();
  await expect(count).toHaveText("Next e-mail (2 more)");
});

test("keeps a result on the floor until the player goes somewhere else", async ({
  page,
}) => {
  await freshRun(page, "/?seed=2&month=7");
  await answerAnyNotification(page);

  await page.locator('[data-testid="hotspot-work"]:enabled').click();

  const card = page.getByTestId("panel-result");
  await expect(card).toContainText("What happened");
  await expect(card).toContainText("Your desk");
  await expect(page.getByTestId("result-spent")).toContainText(
    "That action is spent",
  );
  await expect(page.locator('[data-testid^="hotspot-meeting"]')).toBeEnabled();

  await page.locator('[data-testid^="hotspot-meeting"]').click();

  await expect(card).toHaveCount(0);
  await expect(page.getByTestId("panel-scene")).toBeVisible();
});
