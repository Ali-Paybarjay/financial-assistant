import { expect, test, type Page } from "@playwright/test";

/**
 * دنگ و دونگ, end to end — and the one claim the feature makes that a user
 * cannot check for themselves without doing the arithmetic by hand: a bill one
 * person paid for two people leaves the payer owed exactly half, the
 * settlement table asks for exactly that one payment, and recording it puts
 * everybody back at zero.
 *
 * The group is created at the start of the run and deleted at the end, so the
 * test account is left exactly as it was found. A leftover group from a failed
 * run is cleared first rather than reused: the assertions are about totals,
 * and a group with yesterday's rows in it would not have the ones asserted.
 */

const EMAIL = process.env.E2E_EMAIL ?? "alpha@testmail.dev";
const PASSWORD = process.env.E2E_PASSWORD ?? "test-pass-12345";

const GROUP = "دوره تست E2E";
const FRIEND = "سارا تست";
const EXPENSE = "شام تست";
/** Even, so the half is exact and the rounding rule is not what is under test. */
const AMOUNT = "60";
/** The test account is in a two-decimal currency, as the statement fixture assumes. */
const HALF = /30([.,]00)?/;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);
}

/** Opens the group's page, whichever of the two "add" buttons the list offers. */
async function createGroup(page: Page) {
  await page.goto("/dong");

  const first = page.getByRole("button", { name: "اولین دوره را بساز" });
  const more = page.getByRole("button", { name: "افزودن دوره" });
  await expect(first.or(more).first()).toBeVisible({ timeout: 30_000 });
  await ((await first.isVisible()) ? first : more).click();

  await page.getByLabel("اسم دوره").fill(GROUP);
  await page.getByRole("button", { name: "بساز", exact: true }).click();

  const row = page.getByRole("link", { name: new RegExp(GROUP) });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await page.waitForURL(/\/dong\/[0-9a-f-]{36}/);
}

async function deleteOpenGroup(page: Page) {
  await page.getByRole("button", { name: "ویرایش دوره" }).click();
  await page.getByRole("button", { name: "حذف دوره" }).click();
  await page.getByRole("button", { name: "حذفش کن" }).click();
  await page.waitForURL(/\/dong$/);
}

/** Clears anything a previous failed run left behind. */
async function removeLeftovers(page: Page) {
  await page.goto("/dong");
  for (;;) {
    const row = page.getByRole("link", { name: new RegExp(GROUP) }).first();
    if (!(await row.isVisible().catch(() => false))) return;
    await row.click();
    await page.waitForURL(/\/dong\/[0-9a-f-]{36}/);
    await deleteOpenGroup(page);
  }
}

test("splits a bill, and settles it", async ({ page }) => {
  test.setTimeout(120_000);

  await login(page);
  await removeLeftovers(page);
  await createGroup(page);

  // ------------------------------------------------------- a second person --
  await page.getByRole("tab", { name: "افراد" }).click();
  await page.getByRole("button", { name: "افزودن نفر" }).click();
  await page.getByLabel("اسم", { exact: true }).fill(FRIEND);
  await page.getByRole("button", { name: "اضافه کن" }).click();
  await expect(page.getByText(FRIEND)).toBeVisible({ timeout: 15_000 });

  // ------------------------------------------- one bill, split between two --
  await page.getByRole("tab", { name: "خریدها" }).click();
  await page.getByRole("button", { name: "خرید تازه" }).click();
  await page.getByLabel("چه چیزی").fill(EXPENSE);
  await page.getByLabel("مبلغ", { exact: true }).fill(AMOUNT);
  // Everyone is ticked by default and the default mode is «مساوی», which is
  // the case under test: two people, so half each.
  await page.getByRole("button", { name: "ثبت خرید" }).click();
  await expect(page.getByText(EXPENSE)).toBeVisible({ timeout: 15_000 });

  // The row shows the viewer's own share, not just what the group spent.
  await expect(page.getByText(/سهم تو/)).toBeVisible();

  // ------------------------------------------------ the balance, and a plan --
  await expect(page.getByText("از بقیه طلبکاری")).toBeVisible();

  await page.getByRole("tab", { name: "گزارش" }).click();
  const plan = page.locator("section", { hasText: "جدول تسویه" });
  await expect(plan).toBeVisible({ timeout: 15_000 });

  // Exactly one payment clears a two-person group, and it is the friend's.
  const settleButtons = plan.getByRole("button", { name: "ثبت", exact: true });
  await expect(settleButtons).toHaveCount(1);
  await expect(plan.getByText(FRIEND)).toBeVisible();
  await expect(plan.getByText(HALF).first()).toBeVisible();

  // ------------------------------------------------- recording it squares up --
  await settleButtons.click();
  // The sheet opens already filled in from the plan; confirming is the whole
  // interaction, so the amount is not retyped here on purpose.
  await page.getByRole("button", { name: "ثبت پرداخت" }).click();

  await page.getByRole("tab", { name: "گزارش" }).click();
  await expect(page.getByText("حسابتان صاف است")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("section", { hasText: "جدول تسویه" })).toHaveCount(0);

  await expect(page.getByText("حسابت با بقیه صاف است")).toBeVisible();

  // ------------------------------------------------------------- put it back --
  await deleteOpenGroup(page);
  await expect(page.getByRole("link", { name: new RegExp(GROUP) })).toHaveCount(0);
});

/**
 * The bug this guards against was not in the feature, it was in how you reach
 * it: the tab bar holds four items by design and the sidebar that carries the
 * rest starts at 960px, so on the phone this suite runs at, «دنگ و دونگ» and
 * the accounts page were reachable only from inside Settings.
 *
 * The month is deliberately one with nothing in it. That is the state a new
 * user is in, and it used to replace the whole dashboard — entry points and
 * all — with an invitation to log a first expense.
 */
test("an empty month still shows the way into the pages the tab bar omits", async ({
  page,
}) => {
  await login(page);
  await page.goto("/dashboard?month=2025-01-01");

  // By destination, not by label: the card says «دنگ و دونگ» once there are
  // groups and «ساختن اولین دوره» before that, and what is being asserted is
  // that the dashboard leads there at all — not what the link happens to read.
  // Scoped to <main>, because the sidebar carries its own link to the same
  // place and is merely hidden below 960px rather than absent — matching it
  // would pass while the phone still had no way in, which is the whole bug.
  const dong = page.locator('main a[href="/dong"]').first();
  await expect(dong).toBeVisible({ timeout: 30_000 });

  // Same for accounts, which has the same two states.
  await expect(page.locator('main a[href="/accounts"]').first()).toBeVisible({
    timeout: 30_000,
  });

  await dong.click();
  await page.waitForURL(/\/dong$/);
});
