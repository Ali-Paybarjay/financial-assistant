import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * Accounts, end to end — and the one claim the feature makes that a user
 * cannot verify for themselves without adding up three months by hand: an
 * expense posted to an account comes off that account's balance, by exactly
 * its own amount, and putting it back restores the balance.
 *
 * Written to be run repeatedly against the test account. It creates its
 * account only if it is not already there, and it deletes the transaction it
 * wrote, so the account ends each run holding what it started with.
 */


const ACCOUNT = "حساب تست E2E";
const MERCHANT = "خرید تست موجودی";
/** Minor units. Distinctive enough not to collide with a real fixture row. */
const AMOUNT = "37.25";
const AMOUNT_MINOR = 3725;

async function login(page: Page) {
  await page.goto("/login?method=password");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  // The hub is the landing page now; onboarding still intercepts a new account.
  await page.waitForURL(/\/($|onboarding)/);
}

/**
 * The balance on the account's row, in minor units.
 *
 * <Money /> is the only thing in the row that renders dir="ltr", and the row
 * renders the balance before the movement — so the first one is the balance.
 * Reading the row's whole text instead would pick up the date and the count.
 *
 * The test account is in a two-decimal currency, which is what the ×100 here
 * assumes; the statement fixture asserts dollars for the same reason.
 */
async function balanceOf(page: Page, title: string): Promise<number> {
  await page.goto("/accounts");
  const row = page.getByRole("button", { name: new RegExp(title) });
  await expect(row).toBeVisible({ timeout: 30_000 });

  const text = await row.locator('span[dir="ltr"]').first().innerText();
  // U+2212 is what <Money /> writes a negative with, and it groups with commas.
  const cleaned = text.replace(/−/g, "-").replace(/[^\d.-]/g, "");
  if (cleaned === "") throw new Error(`no amount on the row for ${title}`);

  return Math.round(Number(cleaned) * 100);
}

async function ensureAccount(page: Page) {
  await page.goto("/accounts");

  const existing = page.getByRole("button", { name: new RegExp(ACCOUNT) });
  const addFirst = page.getByRole("button", { name: "اولین حساب را بساز" });
  const add = page.getByRole("button", { name: "افزودن حساب" });

  await expect(existing.or(addFirst).or(add).first()).toBeVisible({ timeout: 30_000 });
  if (await existing.count()) return;

  await ((await addFirst.count()) ? addFirst : add).click();
  await page.getByLabel("اسم حساب").fill(ACCOUNT);
  await page.getByLabel("موجودی", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "ذخیره" }).click();

  await expect(existing).toBeVisible({ timeout: 30_000 });
}

test("an expense posted to an account comes off its balance, and undoing it puts it back", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await login(page);
  await ensureAccount(page);

  const before = await balanceOf(page, ACCOUNT);

  // Record an expense against the account, through the ordinary entry sheet.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "ثبت هزینه", exact: true }).click();
  await page.getByLabel("مبلغ").fill(AMOUNT);
  await page.getByLabel("فروشنده").fill(MERCHANT);
  await page.getByLabel("حساب", { exact: true }).selectOption({ label: ACCOUNT });
  await page.getByRole("button", { name: "ثبت هزینه", exact: true }).last().click();
  await expect(page.getByText(/ثبت شد/)).toBeVisible({ timeout: 30_000 });

  expect(await balanceOf(page, ACCOUNT)).toBe(before - AMOUNT_MINOR);

  // And back again: deleting the transaction restores the balance, because the
  // balance was never a stored number that had to be corrected.
  await page.goto("/transactions");
  await page.getByRole("button", { name: new RegExp(MERCHANT) }).first().click();
  await page.getByRole("button", { name: "حذف" }).click();
  await expect(page.getByText(/حذف شد/)).toBeVisible({ timeout: 30_000 });

  expect(await balanceOf(page, ACCOUNT)).toBe(before);
});

test("the accounts page does not overflow at 375px", async ({ page }) => {
  await login(page);
  await ensureAccount(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
