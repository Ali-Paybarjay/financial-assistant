import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";


async function login(page: Page) {
  await page.goto("/login?method=password");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  // The hub is the landing page now; onboarding still intercepts a new account.
  await page.waitForURL(/\/($|onboarding)/);
}

test("the currency warning is shown before the change, not after", async ({ page }) => {
  await login(page);
  await page.goto("/settings");

  await page.getByRole("button", { name: /ارز پایه/ }).click();
  await expect(page.getByText(/مبالغ قبلی تبدیل نمی‌شوند/)).toBeVisible();

  // Nothing has changed yet — the action button is still inert.
  await expect(page.getByRole("button", { name: "عوضش کن" })).toBeDisabled();
});

test("account deletion is gated on typing the account name", async ({ page }) => {
  await login(page);
  await page.goto("/settings");

  await page.getByRole("button", { name: "حذف حساب" }).click();
  const confirm = page.getByRole("button", { name: "حساب را حذف کن" });
  await expect(confirm).toBeDisabled();

  await page.getByRole("textbox").last().fill("اشتباه");
  await expect(confirm).toBeDisabled();
});

test("settings does not overflow at 375px", async ({ page }) => {
  await login(page);
  await page.goto("/settings");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
