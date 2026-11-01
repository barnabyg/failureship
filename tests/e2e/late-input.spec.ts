import { expect, test, type Page } from "@playwright/test";
import { answerAnyNotification, finishMonth } from "./play";

// The real-content test keeps the report's input late in month 2 on seed 1.
async function reachLateInput(page: Page) {
  await page.goto("/?seed=1");
  await answerAnyNotification(page);
  await finishMonth(page);
  await page.getByTestId("option-skip-training").click();
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("panel-notification")).toContainText(
    "Waiting on",
  );
}

test("chasing late input spends an action, then the report can be filed", async ({
  page,
}) => {
  await reachLateInput(page);
  await expect(page.getByTestId("actions-left")).toContainText("3");

  await page.getByTestId("option-chase").click();
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("actions-left")).toContainText("2");
  await expect(page.getByTestId("option-report")).toBeVisible();
});

test("filing without the input settles the report as an estimate", async ({
  page,
}) => {
  await reachLateInput(page);

  await page.getByTestId("option-file-without").click();
  await expect(page.getByTestId("panel-notice")).toContainText("indicative");
  await page.getByTestId("continue").click();

  await expect(page.getByTestId("option-report")).toHaveCount(0);
  await expect(page.getByTestId("hotspot-kitchen")).toBeEnabled();
});

test("late input reaches the Notebook, and says nothing of anyone's kind", async ({
  page,
}) => {
  await reachLateInput(page);
  await expect(page.getByTestId("panel-notification")).not.toContainText(
    /Believer|Incompetent|Practitioner/i,
  );

  await page.getByTestId("open-notebook").click();

  await expect(
    page.getByTestId("clue").filter({ hasText: "figures were late" }),
  ).toHaveCount(1);
});
