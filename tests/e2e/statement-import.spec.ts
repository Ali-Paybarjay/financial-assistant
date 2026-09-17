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
 * the test account only — and it is written to be run repeatedly. It imports
 * only if anything is still missing, and ends in the same state either way. A
 * second run therefore exercises the warm path, which is the one that matters.
 */

const EMAIL = process.env.E2E_EMAIL ?? "alpha@testmail.dev";
const PASSWORD = process.env.E2E_PASSWORD ?? "test-pass-12345";

const STATEMENT = join(process.cwd(), "tests", "e2e", "fixtures", "statement.csv");

/** U+2212, which is what <Money /> renders a negative with. */
const MINUS = "−";

const ALL_MATCHED = "همه‌ی ردیف‌های این صورت‌حساب از قبل ثبت شده بودند";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);
}

/** The uploader is on screen. Its file input is sr-only, so key off the button. */
function picker(page: Page) {
  return page.getByRole("button", { name: "انتخاب فایل" });
}

async function expectUploader(page: Page) {
  await expect(picker(page)).toBeVisible({ timeout: 30_000 });
}

/**
 * Only one import may be open at a time, so a report left over from an earlier
 * run stands where the uploader would be. Clear it rather than assume a clean
 * account.
 *
 * The page streams in, so wait for one of the two states to actually be on
 * screen before deciding which one it is — `count()` does not wait, and would
 * read an empty page as "no report".
 */
async function clearOpenImport(page: Page) {
  const discard = page.getByRole("button", { name: "بی‌خیال" });
  const cancel = page.getByRole("button", { name: "لغو" });

  await expect(picker(page).or(discard).or(cancel).first()).toBeVisible({
    timeout: 30_000,
  });

  for (const button of [discard, cancel]) {
    if (await button.count()) {
      await button.click();
      await expectUploader(page);
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

/**
 * Every row of the fixture is on the report carrying its own amount, and no
 * running balance is anywhere on the page — whichever side of the report the
 * rows landed on.
 */
async function expectAmountsRead(page: Page) {
  const alreadyRecorded = page.locator("details");
  if (await alreadyRecorded.count()) {
    await alreadyRecorded.first().evaluate((element: HTMLDetailsElement) => {
      element.open = true;
    });
  }

  await expect(page.getByText(`${MINUS}$64.15`, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(`${MINUS}$38.40`, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("+$1,850.00", { exact: true }).first()).toBeVisible();

  // No running balance may appear as a row's amount. The closing balance is
  // allowed on the page, but only in its own tile — so it is excluded from the
  // rows by asking the list, not the whole page.
  const rows = page.locator("main");
  for (const balance of ["3,120.85", "4,970.85"]) {
    await expect(rows.getByText(balance)).toHaveCount(0);
  }
}

/**
 * The closing balance is the one number the row rules spend their whole length
 * telling the model to ignore, so it is asked for separately and by name. It
 * must be read — and it must still not have leaked into any row's amount,
 * which is what expectAmountsRead checks either side of this.
 */
async function expectClosingBalanceRead(page: Page) {
  const tile = page.getByTestId("statement-closing-balance");
  await expect(tile).toBeVisible();
  await expect(tile).toContainText("4,932.45");
}

test("a statement is read, reconciled, imported, and then recognised again", async ({
  page,
}) => {
  test.setTimeout(420_000);

  await login(page);
  await upload(page);
  await expectAmountsRead(page);
  await expectClosingBalanceRead(page);

  // Only rendered while something is still missing from the ledger. On a
  // repeat run the first pass already finds everything and this is skipped.
  const applyButton = page.getByRole("button", { name: /^ثبت .* تراکنش$/ });

  if (await applyButton.count()) {
    await expect(applyButton).toBeEnabled();
    await applyButton.click();
    await expect(page.getByText(/تراکنش ثبت شد/)).toBeVisible({ timeout: 30_000 });

    // The same file again. Everything in it is in the ledger now.
    await upload(page);
    await expectAmountsRead(page);
  }

  await expect(page.getByText(ALL_MATCHED)).toBeVisible();

  // Nothing is offered, so there is nothing that could be written twice.
  await expect(page.getByRole("button", { name: "ردیفی انتخاب نشده" })).toBeDisabled();

  // Leave no report waiting on the next run.
  await page.getByRole("button", { name: "بی‌خیال" }).click();
  await expectUploader(page);
});
