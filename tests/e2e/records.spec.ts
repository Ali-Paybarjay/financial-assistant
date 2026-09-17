import { expect, test, type Page } from "@playwright/test";

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

const EMAIL = process.env.E2E_EMAIL ?? "alpha@testmail.dev";
const PASSWORD = process.env.E2E_PASSWORD ?? "test-pass-12345";

const TITLE = "منبع تست E2E";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);
}

test("a new income source saves, and can be deleted again", async ({ page }) => {
  test.setTimeout(120_000);

  await login(page);
  await page.goto("/income");

  const row = page.getByRole("button", { name: new RegExp(TITLE) });

  // A leftover from an interrupted run would make the create step ambiguous.
  if (await row.count()) {
    await row.first().click();
    await page.getByRole("button", { name: "حذف" }).click();
    await expect(row).toHaveCount(0, { timeout: 15_000 });
  }

  await page.getByRole("button", { name: "افزودن منبع درآمد" }).click();
  await page.getByLabel("عنوان").fill(TITLE);
  await page.getByLabel("مبلغ").fill("123");
  await page.getByRole("button", { name: "ذخیره" }).click();

  await expect(row).toBeVisible({ timeout: 15_000 });

  await row.first().click();
  await page.getByRole("button", { name: "حذف" }).click();
  await expect(row).toHaveCount(0, { timeout: 15_000 });
});
