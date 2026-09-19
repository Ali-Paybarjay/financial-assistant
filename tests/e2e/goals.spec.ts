import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * A goal produces a plan, not just a progress bar.
 *
 * The page has always promised «یک هدف بساز تا بگویم ماهی چقدر باید بگذاری
 * کنار» and, until this, never said it: a goal was a bar, a percentage and a
 * remaining amount, none of which tell anyone what to do in the month they
 * are actually in.
 *
 * The amount is chosen so the arithmetic is readable on the page: a target of
 * 300 three whole months out is 100 a month, whatever the account's currency.
 *
 * It creates and then deletes, so it leaves the test account as it found it.
 */


const TITLE = "هدف تست E2E";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);
}

/** The first of the month three whole months from now, as YYYY-MM-DD. */
function threeMonthsOut(): string {
  const now = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1));
  return target.toISOString().slice(0, 10);
}

test("a goal says what to put aside each month, and when it arrives", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await login(page);
  await page.goto("/goals");

  // The card, not one of the buttons inside it: the reorder controls carry
  // the goal's title in their labels too.
  const card = page.getByRole("listitem").filter({ hasText: TITLE });
  const open = () => card.first().getByRole("button").first().click();

  /**
   * Delete the goal, and wait for the sheet to close before looking at the
   * list.
   *
   * Asserting the card is gone while the sheet is still open proves nothing:
   * the sheet is a modal, so Radix marks the rest of the page aria-hidden,
   * `getByRole` sees no listitems at all, and the count is 0 whether or not
   * anything was deleted. That is not a hypothetical — it let this test pass
   * while leaving its goal behind on the account, once per run.
   */
  const remove = async () => {
    const before = await card.count();
    await open();
    await page.getByRole("button", { name: "حذف" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
    await expect(card).toHaveCount(before - 1, { timeout: 15_000 });
  };

  // Leftovers from interrupted runs would make the create step ambiguous, and
  // there can be more than one: `if` cleared a single row per run, so while
  // the bug above was dropping deletes they piled up faster than they were
  // swept. A loop is what makes the sweep total rather than one-per-run.
  while (await card.count()) await remove();

  await page.getByRole("button", { name: "هدف تازه" }).click();
  await page.getByLabel("عنوان").fill(TITLE);
  await page.getByLabel("مبلغ هدف").fill("300");
  await page.getByLabel("تا چه تاریخی؟").fill(threeMonthsOut());
  await page.getByRole("button", { name: "ذخیره" }).click();

  await expect(card.first()).toBeVisible({ timeout: 15_000 });

  // The number the page exists to produce: 300 over the three months that are
  // left, said in the goal's own card.
  await expect(card.first()).toContainText("ماهی");
  await expect(card.first()).toContainText("100");

  // And the summary that turns the goals into one instruction for the month.
  await expect(
    page.getByRole("heading", { name: "برنامه‌ی پس‌انداز" }),
  ).toBeVisible();

  await remove();
});
