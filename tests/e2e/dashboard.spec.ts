import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * Acceptance test 5 from the brief: the month's expense card must equal the
 * sum of that month's undeleted transactions. If those two ever disagree the
 * product is lying about the one number it exists to report.
 */


async function login(page: Page) {
  await page.goto("/login?method=password");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  // The hub is the landing page now; onboarding still intercepts a new account.
  await page.waitForURL(/\/($|onboarding)/);
}

/** "−$4,111.30" / "+$4,250.00" -> minor units, sign preserved. */
function toMinor(text: string): number {
  const negative = text.includes("−") || text.trim().startsWith("-");
  const digits = text.replace(/[^\d.]/g, "");
  const value = Math.round(Number(digits) * 100);
  return negative ? -value : value;
}

test("the expense card equals the sum of the month's transactions", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard");

  const cardTotal = toMinor(
    (await page.getByTestId("kpi-expense").textContent()) ?? "",
  );
  expect(cardTotal).toBeGreaterThan(0);

  await page.goto("/transactions?type=expense");
  const listTotal = toMinor(
    (await page.getByTestId("filtered-total").textContent()) ?? "",
  );

  // The list renders expenses signed negative; the card shows the magnitude.
  expect(Math.abs(listTotal)).toBe(cardTotal);
});

test("an unconfirmed transaction is marked everywhere it appears", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard");

  // The banner names the count, so colour is never the only carrier.
  await expect(page.getByText(/تراکنش تأییدنشده در این جمع هست/)).toBeVisible();

  await page.goto("/transactions");
  await expect(page.getByText(/تأییدنشده/).first()).toBeVisible();
});

test("the dashboard does not overflow at 375px", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
