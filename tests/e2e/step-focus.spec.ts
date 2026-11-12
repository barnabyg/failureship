import { expect, test } from "@playwright/test";
import { answerAnyNotification, happened } from "./play";

test("the floor is dimmed and shut while a step waits, and open after", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  const stage = page.getByTestId("stage");
  const panel = page.getByTestId("panel-notification");
  const desk = page.getByTestId("hotspot-work");

  // An e-mail waits: it says what it is, and the floor behind it is dark.
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("step-tag")).toHaveText(/^E-mail · /);
  await expect(stage).toHaveAttribute("data-floor", "waiting");
  await expect(desk).toBeDisabled();
  await expect(desk).not.toContainText("Costs");

  // A place clear of the panel, clicked through its room, does nothing.
  const actions = (await page.getByTestId("actions-left").textContent()) ?? "";
  const panelBox = await panel.boundingBox();
  const places = page.locator('[data-testid^="hotspot-"]');
  let room: { x: number; y: number } | null = null;
  for (const place of await places.all()) {
    const box = await place.boundingBox();
    if (box && panelBox && box.x + box.width < panelBox.x) {
      room = { x: box.x + box.width / 2, y: box.y + box.height + 70 };
      break;
    }
  }
  if (!room) throw new Error("No place on the floor is clear of the panel.");
  await page.mouse.move(room.x, room.y);
  await expect(page.locator("canvas")).toHaveCSS("cursor", "default");
  await page.mouse.click(room.x, room.y);
  await expect(panel).toBeVisible();
  await expect(happened(page)).toHaveCount(0);
  await expect(page.getByTestId("actions-left")).toHaveText(actions);

  // With the inbox empty, the floor is the player's, and nothing is dimmed.
  await answerAnyNotification(page);
  await expect(stage).toHaveAttribute("data-floor", "open");
  await expect(page.getByTestId("step-tag")).toHaveCount(0);
  await expect(desk).toBeEnabled();
  await expect(desk).toContainText("Costs 1 action");
});
