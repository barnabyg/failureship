import { expect, test } from "@playwright/test";

test("the lift shows the route up, and cannot be taken yet", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await page.getByTestId("option-report").click();
  await page.getByTestId("continue").click();

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
