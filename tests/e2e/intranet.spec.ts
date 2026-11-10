import { expect, test, type Locator } from "@playwright/test";
import { answerAnyNotification } from "./play";

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

    const invite = page.getByTestId("panel-notification");
    await expect(invite).toContainText("To:");
    await expect(invite).toContainText("Subject:");
    await expect(invite.locator(".stamp")).toHaveText("URGENT");
    expect(await fits(invite)).toBe(true);

    await answerAnyNotification(page);
    await page.getByTestId("hotspot-kitchen").click();
    await page.getByTestId("continue").click();
    await page.getByTestId("hotspot-work").click();
    await page.getByTestId("continue").click();
    // The meeting was missed, and the minutes say so first.
    await expect(page.getByTestId("panel-notice")).toContainText("Subject:");
    await page.getByTestId("continue").click();
    const move = page.getByTestId("panel-move");
    await expect(move.locator(".stamp")).toHaveText("CONFIDENTIAL");
    await page.getByTestId("continue").click();

    const story = page.getByTestId("panel-story");
    await expect(story.locator(".masthead")).toContainText("Inside Track");
    await expect(story.locator(".masthead-issue")).toContainText("1");
    await expect(story.locator(".happened-stamp")).toHaveText("CONFIDENTIAL");
    expect(await fits(story)).toBe(true);
  });
}
