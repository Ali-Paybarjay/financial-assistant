import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * A brand new record can actually be saved.
 *
 * This guards a bug that shipped: every sheet carried the row's id in a hidden
 * input, which hands back "" when there is no row yet. "" is not a uuid, the
 * schema rejected it, and nothing on the form rendered errors.id — so pressing
 * "ذخیره" on a new income source did nothing at all, silently. The id now
 * comes from the record being edited instead of from a form field.
 *
 * It creates and then deletes, so it leaves the test account as it found it.
 */


const TITLE = "منبع تست E2E";

async function login(page: Page) {
  await page.goto("/login?method=password");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  // The capture screen is the landing page; onboarding still intercepts a new account.
  await page.waitForURL(/\/($|onboarding)/);
}

test("a new income source saves, and can be deleted again", async ({ page }) => {
  test.setTimeout(120_000);

  await login(page);
  await page.goto("/income");

  const row = page.getByRole("button", { name: new RegExp(TITLE) });

  /**
   * Delete the row, and wait for the sheet to close before looking at the
   * list.
   *
   * Asserting the row is gone while the sheet is still open proves nothing:
   * the sheet is a modal, so Radix marks the rest of the page aria-hidden,
   * `getByRole` sees nothing at all, and the count is 0 whether or not
   * anything was deleted. This test had been passing while leaving its income
   * source behind on the account.
   */
  const remove = async () => {
    const before = await row.count();
    await row.first().click();
    await page.getByRole("button", { name: "حذف" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
    await expect(row).toHaveCount(before - 1, { timeout: 15_000 });
  };

  // Leftovers from interrupted runs would make the create step ambiguous, and
  // there can be more than one: `if` cleared a single row per run, so while
  // the bug above was dropping deletes they piled up faster than they were
  // swept. A loop is what makes the sweep total rather than one-per-run.
  while (await row.count()) await remove();

  await page.getByRole("button", { name: "افزودن منبع درآمد" }).click();
  await page.getByLabel("عنوان").fill(TITLE);
  await page.getByLabel("مبلغ").fill("123");
  await page.getByRole("button", { name: "ذخیره" }).click();

  await expect(row).toBeVisible({ timeout: 15_000 });

  await remove();
});
