import { expect, test, type Locator } from "@playwright/test";
import { answerAnyNotification, openInboxIfAny, readResult } from "./play";

/** Nothing in the panel is wider than it, so nothing is cut off. */
async function fits(panel: Locator) {
  return panel.evaluate((p) => p.scrollWidth <= p.clientWidth);
}

// The narrowest window the game is laid out for, and the screen it is made for.
for (const [name, size] of [
  ["laptop", { width: 1280, height: 800 }],
  ["full HD", { width: 1920, height: 1080 }],
] as const) {
  test(`the month's mail is intranet e-mail, and its summary the newsletter, at ${name} width`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/?seed=1");

    await openInboxIfAny(page);
    const invite = page.getByTestId("panel-notification");
    await expect(invite).toContainText("To:");
    await expect(invite).toContainText("Subject:");
    await expect(invite.locator(".stamp")).toHaveText("URGENT");
    expect(await fits(invite)).toBe(true);

    await answerAnyNotification(page);
    await page.getByTestId("hotspot-kitchen").click();
    // What the player did has its own look, never an e-mail with no sender.
    const result = page.getByTestId("panel-result");
    await expect(result).toContainText("What happened");
    await expect(result).not.toContainText("To:");
    await expect(result).not.toHaveAttribute("data-look");
    expect(await fits(result)).toBe(true);
    await readResult(page);
    await page.getByTestId("hotspot-work").click();
    await readResult(page);

    // The minutes of the meeting missed, and the Move, head the newsletter.
    const story = page.getByTestId("panel-story");
    await expect(story.getByTestId("landed")).toHaveCount(2);
    await expect(story.getByTestId("landed-list")).toContainText(
      "As the month closed",
    );
    await expect(story.locator(".masthead")).toContainText("Inside Track");
    await expect(story.locator(".masthead-issue")).toContainText("1");
    await expect(story.locator(".happened-stamp")).toHaveText("CONFIDENTIAL");
    expect(await fits(story)).toBe(true);
  });
}
