import { expect, test } from "@playwright/test";

/**
 * Email is switched off for now (lib/auth-methods.ts): nothing that ends in a
 * confirmation link is offered, because nothing can deliver the link. These
 * check the doors that are offered, the ones that are not, and the side
 * entrance the rest of this suite signs in through.
 *
 * Nobody signs in here, so the file costs nothing against any rate limit.
 */
test("the login page offers Google and guest entry, and nothing that needs an email", async ({
  page,
}) => {
  await page.goto("/login");

  await expect(page.getByRole("button", { name: "ورود با گوگل" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ورود به‌عنوان مهمان" })).toBeVisible();

  await expect(page.getByLabel("ایمیل")).toHaveCount(0);
  await expect(page.getByLabel("رمز")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "بساز" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /فراموش/ })).toHaveCount(0);
});

test("sign-up and password reset send the visitor back to the login page", async ({ page }) => {
  await page.goto("/signup");
  await page.waitForURL(/\/login/);

  await page.goto("/forgot-password");
  await page.waitForURL(/\/login/);
});

test("the password form is still there behind ?method=password", async ({ page }) => {
  await page.goto("/login?method=password");

  await expect(page.getByLabel("ایمیل")).toBeVisible();
  await expect(page.getByLabel("رمز")).toBeVisible();
  await expect(page.getByRole("button", { name: "ورود", exact: true })).toBeVisible();
  // The Google door is on this version of the page too, not instead of it.
  await expect(page.getByRole("button", { name: "ورود با گوگل" })).toBeVisible();
});
