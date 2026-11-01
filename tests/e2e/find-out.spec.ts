import { expect, test } from "@playwright/test";
import { answerAnyNotification } from "./play";

test("spends an action to find something out, and sees the claim", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await answerAnyNotification(page);
  await expect(page.getByTestId("actions-left")).toContainText("2");

  await page.getByTestId("hotspot-ask-around").click();
  await expect(page.getByTestId("panel-find-out")).toBeVisible();
  await expect(page.getByTestId("actions-left")).toContainText("1");

  // Someone is already there, so the choice is only whom to ask about.
  await expect(page.locator('[data-testid^="source-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="subject-"]')).toHaveCount(4);
  const prompt = await page.getByTestId("find-out-prompt").innerText();
  const there = /^(\w+ \w+) is/.exec(prompt)?.[1] ?? "nobody";
  await page.locator('[data-testid^="subject-"]').first().click();

  await expect(page.getByTestId("panel-claim")).toContainText(there);
  await expect(page.getByTestId("claim-text")).not.toBeEmpty();
  await expect(page.getByTestId("panel-claim")).not.toContainText(
    /deliberately false|mistaken|out of date/i,
  );

  await page.getByTestId("continue").click();
  await expect(page.getByTestId("hotspot-ask-around")).toBeDisabled();
});

test("buying inside information has only some people to buy from", async ({
  page,
}) => {
  await page.goto("/?seed=1");
  await answerAnyNotification(page);

  await page.getByTestId("hotspot-inside-info").click();

  await expect(page.getByTestId("source-admin")).toBeVisible();
  await expect(page.getByTestId("source-head")).toHaveCount(0);
});
