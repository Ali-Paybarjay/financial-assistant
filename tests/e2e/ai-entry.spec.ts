import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * Acceptance test 2 from the brief: the user writes
 * «۴۵ دلار خرید سوپرمارکت و ۱۲ دلار قهوه» and two transactions with the right
 * categories appear in the confirm card.
 *
 * This spec makes a real model call, so it is deliberately short.
 */


async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);
}

async function openTextTab(page: Page) {
  await page.getByRole("button", { name: "ثبت هزینه" }).first().click();
  await page.getByRole("tab", { name: "متن" }).click();
}

test("free text becomes two transactions in the confirm card", async ({ page }) => {
  test.setTimeout(90_000);

  await login(page);
  await page.goto("/dashboard");
  await openTextTab(page);

  await page
    .getByPlaceholder(/امروز ۴۵ دلار/)
    .fill("امروز ۴۵ دلار خرید از سوپرمارکت و ۱۲ دلار قهوه");
  await page.getByRole("button", { name: "بخوانش" }).click();

  await expect(page.getByText("کارت تأیید")).toBeVisible({ timeout: 45_000 });

  // Nothing is written until the user confirms.
  await expect(page.getByText("تا تأیید نکنی ذخیره نمی‌شود")).toBeVisible();

  // Two transactions, so the button counts them.
  await expect(page.getByRole("button", { name: "ثبت دو تراکنش" })).toBeVisible();

  // Both amounts came through as Latin, tabular money.
  await expect(page.getByText("$45.00")).toBeVisible();
  await expect(page.getByText("$12.00")).toBeVisible();

  // And the categories the model picked are real ones, rendered in Persian.
  await expect(page.getByText("خوراک و سوپرمارکت").first()).toBeVisible();
  await expect(page.getByText("رستوران و کافه").first()).toBeVisible();
});

test("a sentence with no amount is refused rather than guessed", async ({ page }) => {
  test.setTimeout(90_000);

  await login(page);
  await page.goto("/dashboard");
  await openTextTab(page);

  await page.getByPlaceholder(/امروز ۴۵ دلار/).fill("امروز رفتم خرید کردم");
  await page.getByRole("button", { name: "بخوانش" }).click();

  // The amount is the one field that is never inferred.
  await expect(page.getByText(/مبلغی در متن پیدا نکردم/)).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText("کارت تأیید")).toBeHidden();
});
