import { expect, test } from "@playwright/test";
import { openInbox, readResult } from "./play";

// On seed 5 every answer in month 1's inbox has a free one beside it, so all
// three actions can go on the floor, leaving the pub in the inbox unaffordable.
test("a place or an answer that cannot be chosen looks it, and says why", async ({
  page,
}) => {
  await page.goto("/?seed=5");
  for (let i = 0; i < 3; i++) {
    await page.getByTestId("hotspot-work").click();
    await readResult(page);
  }

  const desk = page.getByTestId("hotspot-work");
  await expect(desk).toBeDisabled();
  await expect(desk).toContainText("No actions left");
  await expect(desk).toHaveCSS("cursor", "not-allowed");

  await openInbox(page);
  const pub = page.getByTestId("option-pub");
  await expect(pub).toBeDisabled();
  await expect(pub.getByTestId("blocked-by")).toHaveText("No actions left");
  await expect(pub).toHaveCSS("border-style", "dashed");
  await expect(pub).toHaveCSS("cursor", "not-allowed");

  const free = page.getByTestId("option-decline");
  await expect(free).toBeEnabled();
  await expect(free).toHaveCSS("border-style", "solid");
  await expect(free.getByTestId("blocked-by")).toHaveCount(0);
});
