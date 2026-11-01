import { expect, test } from "@playwright/test";
import { answerAnyNotification } from "./play";

test("the lift shows the route up, and cannot be taken yet", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await answerAnyNotification(page);

  const sign = page.getByTestId("room-sign-lift");
  await expect(sign).toContainText("Floor 2");
  await expect(page.getByRole("button", { name: /lift/i })).toHaveCount(0);

  const box = await sign.boundingBox();
  if (!box) throw new Error("The lift has no sign position.");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 40);

  await expect(page.getByTestId("panel-notice")).toHaveCount(0);
  await expect(page.getByTestId("actions-left")).toContainText("2");
});

test("every place on the floor can be seen on a laptop screen", async ({
  page,
}) => {
  await page.goto("/?seed=1");

  for (const id of ["hotspot-meeting", "hotspot-kitchen", "room-sign-lift"]) {
    await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
  }
  const status = await page.locator(".status").boundingBox();
  const sign = await page.getByTestId("room-sign-lift").boundingBox();
  if (!status || !sign) throw new Error("Nothing to measure.");
  expect(sign.y).toBeGreaterThanOrEqual(status.y + status.height);
});

test("the furniture is part of the place, and the scenery is not", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await answerAnyNotification(page);
  const canvas = page.locator("canvas");

  // Bare carpet at the front of the floor, between the two desks.
  await page.mouse.move(640, 660);
  await expect(canvas).toHaveCSS("cursor", "default");
  await page.mouse.click(640, 660);
  await expect(page.getByTestId("panel-notice")).toHaveCount(0);
  await expect(page.getByTestId("actions-left")).toContainText("2");

  // The chair at Your desk, well below its label.
  const label = await page.getByTestId("hotspot-work").boundingBox();
  if (!label) throw new Error("The desk has no label position.");
  const chair = {
    x: label.x + label.width / 2,
    y: label.y + label.height + 70,
  };
  await page.mouse.move(chair.x, chair.y);
  await expect(canvas).toHaveCSS("cursor", "pointer");
  await page.mouse.click(chair.x, chair.y);
  await expect(page.getByTestId("panel-notice")).toBeVisible();
  await expect(page.getByTestId("actions-left")).toContainText("1");
});

test("a place lights up under the mouse, and dims once it is done", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await answerAnyNotification(page);
  const canvas = page.locator("canvas");
  await page.mouse.move(640, 660);
  const resting = await canvas.screenshot();

  const label = await page.getByTestId("hotspot-meeting").boundingBox();
  if (!label) throw new Error("The meeting room has no label position.");
  await page.mouse.move(label.x + label.width / 2, label.y + label.height + 24);
  await expect(canvas).toHaveCSS("cursor", "pointer");
  expect(await canvas.screenshot()).not.toEqual(resting);

  await page.mouse.move(640, 660);
  await expect(canvas).toHaveCSS("cursor", "default");
  expect(await canvas.screenshot()).toEqual(resting);

  await page.getByTestId("hotspot-meeting").click();
  await page.getByTestId("scene-option-say-nothing").click();
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("hotspot-meeting")).toBeDisabled();
  expect(await canvas.screenshot()).not.toEqual(resting);
});
