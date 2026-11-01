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

  await page.getByTestId("source-analyst").click();
  await expect(page.getByTestId("subject-analyst")).toHaveCount(0);
  await page.getByTestId("subject-boss").click();

  await expect(page.getByTestId("panel-claim")).toContainText("Priya Venn");
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
