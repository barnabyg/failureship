import { expect, test, type Page } from "@playwright/test";
import { blockingPanel, freshRun, openInbox, openMeeting } from "./play";

/** Answers every e-mail in the inbox with its first answer, from the top. */
async function answerInboxFirst(page: Page) {
  await openInbox(page);
  const mail = page.getByTestId("panel-notification");
  while (await mail.isVisible()) {
    const subject = await mail.locator("h2").innerText();
    await mail.locator('[data-testid^="option-"]:enabled').first().click();
    await expect(mail.locator("h2", { hasText: subject })).toHaveCount(0);
  }
}

test.describe("the inbox", () => {
  test("leaves the floor open as the month opens, with the e-mails listed beside it", async ({
    page,
  }) => {
    await freshRun(page, "/?seed=2&month=7");
    const inbox = page.getByTestId("panel-inbox");
    const mail = page.getByTestId("panel-notification");

    // Closed, the inbox is a list, clear of every place on the floor.
    await expect(inbox.getByTestId("inbox-item")).toHaveCount(4);
    await expect(page.getByTestId("open-inbox")).toHaveText("4 to answer");
    await expect(inbox.getByTestId("step-tag")).toHaveText(
      "Inbox · 4 to answer before the month closes",
    );
    await expect(page.getByTestId("stage")).toHaveAttribute(
      "data-floor",
      "open",
    );
    await expect(blockingPanel(page)).toHaveCount(0);
    const list = await inbox.boundingBox();
    for (const place of await page.locator('[data-testid^="hotspot-"]').all()) {
      const box = await place.boundingBox();
      if (!list || !box) throw new Error("Not on the screen.");
      expect(box.y > list.y + list.height || box.x + box.width < list.x).toBe(
        true,
      );
    }

    // An action first: the e-mails still wait, to be answered in any order.
    await page.getByTestId("hotspot-work").click();
    await expect(page.getByTestId("inbox-item")).toHaveCount(4);
    await page.getByTestId("inbox-item").last().click();
    await expect(mail.locator("h2")).toHaveText("Hot-desking: where are we?");
    await mail.locator('[data-testid^="option-"]').first().click();
    await expect(page.getByTestId("open-inbox")).toHaveText("3 to answer");
    // Answered, the next one opens in its place.
    await expect(mail.locator("h2")).toHaveText(
      "A quick word, if you have a moment",
    );
    await page.getByTestId("inbox-hide").click();
    await expect(mail).toHaveCount(0);
    await expect(page.getByTestId("inbox-item")).toHaveCount(3);
  });

  test("shows a recurring e-mail short after its first time, with its full text a click away", async ({
    page,
  }) => {
    await freshRun(page, "/?seed=2&month=7");
    await page
      .getByTestId("inbox-item")
      .filter({ hasText: "Monthly Status Report" })
      .click();
    const mail = page.getByTestId("panel-notification");

    await expect(mail.locator("h2")).toHaveText(/Monthly Status Report/);
    await expect(mail.getByTestId("mail-body")).toHaveCount(0);
    await expect(page.getByTestId("option-report")).toBeVisible();
    await mail.getByTestId("mail-read-full").click();
    await expect(mail.getByTestId("mail-body")).toBeVisible();
  });

  test("will not let the month close with an e-mail unanswered, and says why", async ({
    page,
  }) => {
    await freshRun(page, "/?seed=2&month=7");
    // All three actions on the floor, with the inbox left alone.
    await openMeeting(page);
    await page.locator('[data-testid^="scene-option-"]').first().click();
    await page.getByTestId("hotspot-work").click();
    await page.getByTestId("hotspot-ask-around").click();
    await page.locator('[data-testid^="subject-"]').first().click();

    await expect(page.getByTestId("actions-left")).toContainText("0 actions");
    await expect(page.getByTestId("month")).toContainText("7 of 18");
    await expect(page.getByTestId("hint")).toHaveText(
      /cannot close until you answer your inbox: 4 still to answer/,
    );
    await expect(page.getByTestId("panel-story")).toHaveCount(0);

    await answerInboxFirst(page);
    await expect(page.getByTestId("panel-story")).toBeVisible();
  });

  test("puts no more than three panels between month 7's last action and month 8's floor", async ({
    page,
  }) => {
    await freshRun(page, "/?seed=2&month=7");
    // Plainly, taking the first option each time: the inbox, the meeting, the desk.
    await answerInboxFirst(page);
    await openMeeting(page);
    await page.locator('[data-testid^="scene-option-"]').first().click();
    await expect(blockingPanel(page)).toHaveCount(0);
    await page.getByTestId("hotspot-work").click();

    // The last action is spent: count every panel that waits, to month 8's floor.
    const month = page.getByTestId("month");
    const seen: string[] = [];
    for (;;) {
      const waiting = blockingPanel(page);
      await expect(
        waiting.or(page.getByTestId("panel-inbox")).first(),
      ).toBeVisible();
      const onFloor = !(await waiting.isVisible());
      if ((await month.innerText()).includes("8 of 18") && onFloor) break;
      seen.push((await waiting.getAttribute("data-testid")) ?? "");
      await waiting
        .locator(
          '[data-testid="continue"], [data-testid^="escape-"], [data-testid^="scene-option-"]',
        )
        .first()
        .click();
    }

    await expect(page.getByTestId("stage")).toHaveAttribute(
      "data-floor",
      "open",
    );
    expect(seen.length).toBeLessThanOrEqual(3);
    expect(seen).toEqual(["panel-story"]);
  });
});
