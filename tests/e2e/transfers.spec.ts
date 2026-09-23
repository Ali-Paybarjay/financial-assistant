import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * Moving money between two of the user's own accounts.
 *
 * The two claims worth testing are the ones a user cannot check by eye: the
 * money leaves one balance and arrives in the other by exactly the same
 * amount, and it does NOT show up as either income or an expense for the
 * month. The second is the whole reason a transfer is not just two rows typed
 * by hand — get it wrong and the month's totals are quietly inflated.
 *
 * Repeatable: it creates its accounts only if missing, and deletes the
 * transfer it wrote.
 */


const FROM = "مبدأ تست E2E";
const TO = "مقصد تست E2E";
const AMOUNT = "60.00";
const AMOUNT_MINOR = 6000;
/** An outflow that is really a move to savings — what a statement hands you. */
const MISFILED = "جابه‌جایی تست E2E";

async function login(page: Page) {
  await page.goto("/login?method=password");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  // The hub is the landing page now; onboarding still intercepts a new account.
  await page.waitForURL(/\/($|onboarding)/);
}

/** The balance on an account's row, in minor units. See accounts.spec.ts. */
async function balanceOf(page: Page, title: string): Promise<number> {
  await page.goto("/accounts");
  const row = page.getByRole("button", { name: new RegExp(title) });
  await expect(row).toBeVisible({ timeout: 30_000 });

  const text = await row.locator('span[dir="ltr"]').first().innerText();
  const cleaned = text.replace(/−/g, "-").replace(/[^\d.-]/g, "");
  return Math.round(Number(cleaned) * 100);
}

async function ensureAccount(page: Page, title: string, balance: string) {
  await page.goto("/accounts");

  const existing = page.getByRole("button", { name: new RegExp(title) });
  const addFirst = page.getByRole("button", { name: "اولین حساب را بساز" });
  const add = page.getByRole("button", { name: "افزودن حساب" });

  await expect(existing.or(addFirst).or(add).first()).toBeVisible({ timeout: 30_000 });
  if (await existing.count()) return;

  await ((await addFirst.count()) ? addFirst : add).click();
  await page.getByLabel("اسم حساب").fill(title);
  await page.getByLabel("موجودی", { exact: true }).fill(balance);
  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(existing).toBeVisible({ timeout: 30_000 });
}

test("a transfer moves money between accounts without touching the month's totals", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await login(page);
  await ensureAccount(page, FROM, "2000");
  await ensureAccount(page, TO, "500");

  const fromBefore = await balanceOf(page, FROM);
  const toBefore = await balanceOf(page, TO);

  // What the month looked like before, so the claim "a transfer is neither
  // income nor an expense" can be checked rather than assumed.
  await page.goto("/dashboard");
  const expenseCard = page.getByTestId("kpi-expense");
  await expect(expenseCard).toBeVisible({ timeout: 30_000 });
  const monthBefore = await expenseCard.innerText();

  await page.getByRole("button", { name: "ثبت هزینه", exact: true }).click();
  // The segmented control is a tablist, so its segments are tabs, not buttons.
  await page.getByRole("tab", { name: "انتقال" }).click();
  await page.getByLabel("مبلغ").fill(AMOUNT);
  await page.getByLabel("از حساب").selectOption({ label: FROM });
  await page.getByLabel("به حساب").selectOption({ label: TO });
  await page.getByRole("button", { name: "ثبت انتقال" }).click();
  await expect(page.getByText(/انتقال ثبت شد/)).toBeVisible({ timeout: 30_000 });

  expect(await balanceOf(page, FROM)).toBe(fromBefore - AMOUNT_MINOR);
  expect(await balanceOf(page, TO)).toBe(toBefore + AMOUNT_MINOR);

  // The month is untouched: the same money cannot be a loss and a gain.
  await page.goto("/dashboard");
  await expect(expenseCard).toBeVisible({ timeout: 30_000 });
  expect(await expenseCard.innerText()).toBe(monthBefore);

  // Clean up, and confirm both balances come back.
  await page.goto("/transactions");
  await page.getByRole("button", { name: /انتقال بین حساب‌ها/ }).first().click();
  await page.getByRole("button", { name: "حذف" }).click();
  await expect(page.getByText(/حذف شد/)).toBeVisible({ timeout: 30_000 });

  expect(await balanceOf(page, FROM)).toBe(fromBefore);
  expect(await balanceOf(page, TO)).toBe(toBefore);
});

test("an account offers its own update button, and it lands on that account", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await login(page);
  await ensureAccount(page, FROM, "2000");

  await page.goto("/accounts");
  await page.getByRole("link", { name: `بروزرسانی ${FROM}` }).click();

  await expect(page.getByRole("heading", { name: `بروزرسانی ${FROM}` })).toBeVisible({
    timeout: 30_000,
  });

  // The account is not a question here — it was answered by the button that
  // opened the page, and a select that could silently change it is how a
  // statement gets filed against the wrong account.
  await expect(page.getByLabel("صورت‌حساب کدام حساب است؟")).toHaveCount(0);
});

/** The month's expense card, in minor units. */
async function monthExpense(page: Page): Promise<number> {
  await page.goto("/dashboard");
  const card = page.getByTestId("kpi-expense");
  await expect(card).toBeVisible({ timeout: 30_000 });

  const text = await card.locator('span[dir="ltr"]').first().innerText();
  const cleaned = text.replace(/\u2212/g, "-").replace(/[^\d.-]/g, "");
  return Math.round(Number(cleaned) * 100);
}

test("an expense can be reclassified as a transfer, and the month stops counting it", async ({
  page,
}) => {
  test.setTimeout(180_000);

  // The case a bank statement creates on its own: "transfer to savings" is
  // printed as an ordinary outflow, so it imports as an expense and the month
  // counts it as spending until someone says otherwise.
  await login(page);
  await ensureAccount(page, FROM, "2000");
  await ensureAccount(page, TO, "500");

  const fromBefore = await balanceOf(page, FROM);
  const toBefore = await balanceOf(page, TO);
  const expenseBefore = await monthExpense(page);

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "ثبت هزینه", exact: true }).click();
  await page.getByLabel("مبلغ").fill(AMOUNT);
  await page.getByLabel("فروشنده").fill(MISFILED);
  await page.getByLabel("حساب", { exact: true }).selectOption({ label: FROM });
  await page.getByRole("button", { name: "ثبت هزینه", exact: true }).last().click();
  await expect(page.getByText(/ثبت شد/)).toBeVisible({ timeout: 30_000 });

  expect(await balanceOf(page, FROM)).toBe(fromBefore - AMOUNT_MINOR);
  expect(await monthExpense(page)).toBe(expenseBefore + AMOUNT_MINOR);

  // Reclassify it.
  await page.goto("/transactions");
  await page.getByRole("button", { name: new RegExp(MISFILED) }).first().click();
  await page.getByLabel("نوع").selectOption({ label: "انتقال" });
  await page.getByLabel("به حساب").selectOption({ label: TO });

  // The far account's balance moves too, and that account is not on screen —
  // so the sheet has to say so before it happens.
  await expect(page.getByTestId("type-change-note")).toBeVisible();

  await page.getByRole("button", { name: "ذخیره" }).click();
  await expect(page.getByTestId("type-change-note")).toHaveCount(0, { timeout: 30_000 });

  // The money still left FROM, now it also arrives in TO, and the month no
  // longer counts it as spending.
  expect(await balanceOf(page, FROM)).toBe(fromBefore - AMOUNT_MINOR);
  expect(await balanceOf(page, TO)).toBe(toBefore + AMOUNT_MINOR);
  expect(await monthExpense(page)).toBe(expenseBefore);

  // Clean up.
  await page.goto("/transactions");
  await page.getByRole("button", { name: /انتقال بین حساب‌ها/ }).first().click();
  await page.getByRole("button", { name: "حذف" }).click();
  await expect(page.getByText(/حذف شد/)).toBeVisible({ timeout: 30_000 });

  expect(await balanceOf(page, FROM)).toBe(fromBefore);
  expect(await balanceOf(page, TO)).toBe(toBefore);
});
