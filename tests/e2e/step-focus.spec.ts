import { expect, test } from "@playwright/test";
import {
  answerAnyNotification,
  happened,
  openMeeting,
  readResult,
} from "./play";

test("the floor stays open beside the inbox, and is dimmed and shut while a step waits", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  const stage = page.getByTestId("stage");
  const inbox = page.getByTestId("panel-inbox");
  const desk = page.getByTestId("hotspot-work");

  // An e-mail in the inbox waits for nothing: the floor stays open beside it.
  await expect(inbox).toBeVisible();
  await expect(inbox.getByTestId("step-tag")).toHaveText(/^Inbox · /);
  await expect(stage).toHaveAttribute("data-floor", "open");
  await expect(desk).toBeEnabled();
  await answerAnyNotification(page);

  // A meeting waits for an answer: it says what it is, and the floor behind it is dark.
  await openMeeting(page);
  const scene = page.getByTestId("panel-scene");
  await expect(scene.getByTestId("step-tag")).toHaveText("Meeting");
  await expect(stage).toHaveAttribute("data-floor", "waiting");
  await expect(desk).toBeDisabled();
  await expect(desk).not.toContainText("Costs");

  // A place clear of the panel, clicked through its room, does nothing.
  const actions = (await page.getByTestId("actions-left").textContent()) ?? "";
  const panelBox = await scene.boundingBox();
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
  await expect(scene).toBeVisible();
  await expect(happened(page)).toHaveCount(0);
  await expect(page.getByTestId("actions-left")).toHaveText(actions);

  // Answered, the floor is the player's again, and nothing is dimmed.
  await page.locator('[data-testid^="scene-option-"]').first().click();
  // What came of it first, alone, with the floor still waiting.
  await expect(happened(page)).toBeVisible();
  await expect(stage).toHaveAttribute("data-floor", "waiting");
  await expect(page.getByTestId("step-tag")).toHaveCount(0);
  await readResult(page);
  await expect(stage).toHaveAttribute("data-floor", "open");
  await expect(page.getByTestId("step-tag")).toHaveCount(0);
  await expect(desk).toBeEnabled();
  await expect(desk).toContainText("Costs 1 action");
});
