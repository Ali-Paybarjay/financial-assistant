import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * دنگ و دونگ, end to end — and the two claims the feature makes that a user
 * cannot check for themselves without doing the arithmetic by hand:
 *
 *   * a bill one person paid for two people leaves the payer owed exactly
 *     half, the settlement table asks for exactly that one payment, and
 *     recording it puts everybody back at zero;
 *   * and when the payer is the user, the whole bill also leaves the account
 *     they named — so the trip is in their own books, not only in the group's.
 *
 * The group is created at the start of the run and deleted at the end, so the
 * test account is left exactly as it was found. A leftover group from a failed
 * run is cleared first rather than reused: the assertions are about totals,
 * and a group with yesterday's rows in it would not have the ones asserted.
 */


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
  // The hub is the landing page now; onboarding still intercepts a new account.
  await page.waitForURL(/\/($|onboarding)/);
}

/**
 * Opens the group's page, whichever of the two "add" buttons the list offers,
 * and points the group at one of the account's own accounts when there is one
 * in its currency. Returns whether it managed to — the ledger half of this
 * suite is skipped on a fixture with no accounts rather than failed, because
 * that is a fact about the fixture and not about the feature.
 */
async function createGroup(page: Page): Promise<boolean> {
  await page.goto("/dong");

  const first = page.getByRole("button", { name: "اولین دوره را بساز" });
  const more = page.getByRole("button", { name: "افزودن دوره" });
  await expect(first.or(more).first()).toBeVisible({ timeout: 30_000 });
  await ((await first.isVisible()) ? first : more).click();

  await page.getByLabel("اسم دوره").fill(GROUP);

  const account = page.getByLabel("از کدام حسابت");
  const linked = await account.isVisible().catch(() => false);
  // Index 0 is a real account: "بدون حساب (نقدی)" is deliberately last.
  if (linked) await account.selectOption({ index: 0 });

  await page.getByRole("button", { name: "بساز", exact: true }).click();

  const row = page.getByRole("link", { name: new RegExp(GROUP) });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await page.waitForURL(/\/dong\/[0-9a-f-]{36}/);

  return linked;
}

async function openGroup(page: Page) {
  await page.goto("/dong");
  await page.getByRole("link", { name: new RegExp(GROUP) }).first().click();
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
  test.setTimeout(150_000);

  await login(page);
  await removeLeftovers(page);
  const linked = await createGroup(page);

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
  // the case under test: two people, so half each. The payer defaults to the
  // viewer, and with it the account the group was given.
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

  // ------------------------------------------- and it is in the user's books --
  if (linked) {
    // The whole bill left the account, not the viewer's half of it: that is
    // what the bank will say, and the half they are owed comes back as its
    // own row when it is paid.
    await expect(page.getByText("از حساب‌های خودت")).toBeVisible();

    await page.goto("/transactions");
    const mirrored = page.getByText(new RegExp(`${EXPENSE} · ${GROUP}`)).first();
    await expect(mirrored).toBeVisible({ timeout: 30_000 });

    // And it is not editable from this side: the purchase is the original.
    await mirrored.click();
    await expect(page.getByRole("link", { name: /رفتن به آن دوره/ })).toBeVisible();

    await openGroup(page);
  }

  // ------------------------------------------------------------- put it back --
  await deleteOpenGroup(page);
  await expect(page.getByRole("link", { name: new RegExp(GROUP) })).toHaveCount(0);
});

/**
 * The hub's own way out.
 *
 * It is the one signed-in screen with no sidebar and no tab bar, so for a
 * while it was also the one with no route to settings — the only way to sign
 * out of the screen that exists to let you choose was to pick one of the two
 * choices first. The button is asserted here, on the page it belongs to,
 * because typecheck and lint cannot see a header.
 */
test("the hub can be signed out of without entering a workspace", async ({
  page,
}) => {
  await login(page);
  await page.goto("/");

  const exit = page.getByRole("button", { name: "خروج", exact: true });
  await expect(exit).toBeVisible({ timeout: 30_000 });

  // A real account leaves on the tap: it is undone by signing back in, so
  // there is nothing to confirm. Only a guest gets the sheet.
  await exit.click();
  await page.waitForURL(/\/login/);
});

/**
 * The split itself: after signing in you are asked which half of the app you
 * are here for, and each half shows only its own.
 *
 * The bug this replaces was the opposite one — «دنگ و دونگ» was reachable on
 * a phone only from inside Settings, so the dashboard had to carry a card for
 * it. Now the way in is the first screen, and the dashboard is free to be
 * about one person's month again. Both halves of that are asserted here,
 * because a hub that leads everywhere while the dashboard still carries the
 * old card is not a separation, it is a duplicate.
 */
test("the hub leads to both halves, and neither carries the other", async ({
  page,
}) => {
  await login(page);
  await page.goto("/");

  const toPersonal = page.locator('main a[href="/dashboard"]').first();
  const toDong = page.locator('main a[href="/dong"]').first();
  await expect(toPersonal).toBeVisible({ timeout: 30_000 });
  await expect(toDong).toBeVisible();

  await toDong.click();
  await page.waitForURL(/\/dong$/);
  // Nothing of the ledger inside the trip: not in the page, not in the nav.
  await expect(page.locator('a[href="/dashboard"]')).toHaveCount(0);
  await expect(page.locator('a[href="/transactions"]')).toHaveCount(0);

  // Back out through the header switch, which is the only door. Filtered to
  // the visible one: the switch is rendered twice — in the sidebar and in the
  // phone's header strip — and on a 375px viewport the sidebar copy is in the
  // DOM but hidden, and it is the one that comes first.
  await page
    .locator('a[href="/"]')
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForURL(/\/$/);

  await toPersonal.click();
  await page.waitForURL(/\/dashboard/);
  // …and nothing of the trip inside the ledger.
  await expect(page.locator('a[href="/dong"]')).toHaveCount(0);

  // An empty month still shows the way to the pages the tab bar omits. That
  // used to be replaced wholesale by an invitation to log a first expense.
  await page.goto("/dashboard?month=2025-01-01");
  await expect(page.locator('main a[href="/accounts"]').first()).toBeVisible({
    timeout: 30_000,
  });
});
