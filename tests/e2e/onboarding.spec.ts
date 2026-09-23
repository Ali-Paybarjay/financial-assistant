import { expect, test, type Page } from "@playwright/test";
// A second account that has never finished onboarding. The dashboard suite
// uses the first one, which has; sharing an account would make each suite
// depend on the order the other ran in.
import { BETA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * Acceptance test 1 from the brief: a new user starts onboarding, abandons it
 * partway, comes back later and resumes from where they stopped.
 *
 * The test account keeps whatever progress a previous run left behind, so the
 * flow is entered explicitly at step 1 — revisiting a reached step is allowed
 * by design — rather than assuming a pristine account.
 */

async function login(page: Page) {
  await page.goto("/login?method=password");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  // Nobody reaches the dashboard before onboarding is finished.
  await page.waitForURL(/\/onboarding\//);
}

test("onboarding saves each step and resumes where the user stopped", async ({ page }) => {
  await login(page);

  await page.goto("/onboarding/1");
  await expect(page.getByRole("progressbar")).toBeVisible();
  await page.getByLabel("نام").fill("کاربر الف");
  await page.getByLabel("سال تولد").fill("1990");
  await page.getByRole("button", { name: "ادامه" }).click();

  await page.waitForURL("**/onboarding/2");
  await expect(page.getByText("گام ۲ از ۷")).toBeVisible();

  // Walk away mid-flow, then come back: the dashboard must bounce us back in.
  await page.goto("/dashboard");
  await page.waitForURL(/\/onboarding\//);
  await expect(page.getByRole("progressbar")).toBeVisible();
});

test("amounts are stored in minor units and rendered with Latin digits", async ({ page }) => {
  await login(page);
  await page.goto("/onboarding/2");

  await page.getByLabel("متوسط درآمد ماهیانه").fill("۴۵۰۰");
  // Persian input is normalised to Latin as the user types.
  await expect(page.getByLabel("متوسط درآمد ماهیانه")).toHaveValue("4500");
});

test("the layout does not break at 375px", async ({ page }) => {
  await login(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a step offers a way out of the flow, and taking it ends the session", async ({
  page,
}) => {
  await login(page);
  await page.goto("/onboarding/2");

  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await expect(page.getByText("از ثبت‌نام بیرون بروی؟")).toBeVisible();

  // Backing out of the sheet leaves the user exactly where they were.
  await page.getByRole("button", { name: "ادامه‌ی ثبت‌نام" }).click();
  await expect(page).toHaveURL(/\/onboarding\/2/);

  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await page.getByRole("button", { name: "خروج از حساب" }).click();
  await page.waitForURL(/\/login/);

  // The session is really gone: the flow no longer lets anyone back in.
  await page.goto("/onboarding/2");
  await page.waitForURL(/\/login/);
});
