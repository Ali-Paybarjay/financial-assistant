import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";

/**
 * Bank statement import, end to end.
 *
 * The fixture is built around the two ways this feature fails silently:
 *
 *  - every row carries a running balance larger than its own amount, so a
 *    reader that grabs the biggest number on the line reports 3,120.85 rather
 *    than 64.15;
 *  - the same file is uploaded twice. The second pass must find nothing new,
 *    because the rows the first pass wrote are in the ledger now. That is the
 *    whole promise of the feature, and it is the one thing a user cannot check
 *    for themselves without re-reading three months of their own statement.
 *
 * It makes real model calls and writes real transactions, so it runs against
 * the test account only.
 */

const EMAIL = process.env.E2E_EMAIL ?? "alpha@testmail.dev";
const PASSWORD = process.env.E2E_PASSWORD ?? "test-pass-12345";

const STATEMENT = join(process.cwd(), "tests", "e2e", "fixtures", "statement.csv");

/** U+2212, which is what <Money /> renders a negative with. */
const MINUS = "−";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);
}

/**
 * Only one import may be open at a time, so a report left over from an earlier
 * run stands where the uploader would be. Clear it rather than assume a clean
 * account.
 */
async function clearOpenImport(page: Page) {
  for (const label of ["بی‌خیال", "لغو"]) {
    const button = page.getByRole("button", { name: label });
    if (await button.count()) {
      await button.click();
      await expect(page.locator('input[type="file"]')).toHaveCount(1, {
        timeout: 20_000,
      });
      return;
    }
  }
}

async function upload(page: Page) {
  await page.goto("/import");
  await clearOpenImport(page);

  await page.locator('input[type="file"]').setInputFiles(STATEMENT, { timeout: 20_000 });
  await page.getByRole("button", { name: "بخوان" }).click({ timeout: 20_000 });
  await expect(page.getByText("گزارش صورت‌حساب")).toBeVisible({ timeout: 180_000 });
}

test("a statement is read, reconciled, imported, and then recognised again", async ({
  page,
}) => {
  test.setTimeout(420_000);

  await login(page);

  // ---------------------------------------------------------- first pass --
  await upload(page);

  // The amount is the row's own, never the running balance beside it, and the
  // sign comes from which column the figure sat in. Exact strings, because the
  // summary above the list carries the same figures unsigned.
  await expect(page.getByText(`${MINUS}$64.15`, { exact: true })).toBeVisible();
  await expect(page.getByText(`${MINUS}$38.40`, { exact: true })).toBeVisible();
  await expect(page.getByText("+$1,850.00", { exact: true })).toBeVisible();

  // Every balance on the fixture, nowhere on the page.
  for (const balance of ["3,120.85", "4,970.85", "4,932.45"]) {
    await expect(page.getByText(balance)).toHaveCount(0);
  }

  const applyButton = page.getByRole("button", { name: /^ثبت .* تراکنش$/ });
  await expect(applyButton).toBeEnabled();
  await applyButton.click();

  await expect(page.getByText(/تراکنش ثبت شد/)).toBeVisible({ timeout: 30_000 });

  // --------------------------------------------------------- second pass --
  // The same file again. Everything in it is now in the ledger.
  await upload(page);

  await expect(
    page.getByText("همه‌ی ردیف‌های این صورت‌حساب از قبل ثبت شده بودند"),
  ).toBeVisible();

  // Nothing is offered, so there is nothing that could be written twice.
  await expect(page.getByRole("button", { name: "ردیفی انتخاب نشده" })).toBeDisabled();
});
