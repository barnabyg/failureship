import { expect, type Page } from "@playwright/test";

/** Opens the Run menu in the header, which holds New run and Restart from seed. */
export async function openRunMenu(page: Page) {
  const menu = page.getByTestId("run-menu");
  if ((await menu.getAttribute("aria-expanded")) !== "true") await menu.click();
  await expect(page.getByTestId("new-run")).toBeVisible();
}
