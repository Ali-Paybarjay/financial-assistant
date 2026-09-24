import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * The front door.
 *
 * «/» used to be the chooser and then the board; it is now the field, because
 * most launches of this app exist to write down one purchase and the board
 * charged every one of them a write and twelve reads to say so.
 *
 * What is asserted here is the part that is new: that opening the app lands on
 * the field, that the one figure above it is also the way to the board, and
 * that saving leaves you on «/» with an empty field rather than anywhere else.
 * Parsing has ai-entry.spec.ts and the sheet has composer.spec.ts; this is
 * about where you stand.
 *
 * One test, several phases, because each `test()` costs a sign-in and the
 * fixture account shares an hourly cap with every other spec in the suite.
 */

async function login(page: Page) {
  await page.goto("/login?method=password");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/($|onboarding|dashboard)/);
}

test("the app opens on the field, and saving leaves you standing on it", async ({
  page,
}) => {
  test.setTimeout(180_000);

  // No model call anywhere in this spec. The gate is supposed to handle an
  // amount with nothing said about it, and proving it does is cheaper and
  // more reliable than proving what a model returned.
  let askedTheModel = false;
  await page.route("**/api/parse/text", async (route) => {
    askedTheModel = true;
    await route.abort();
  });

  await login(page);

  // Signing in lands on the field, with no further navigation.
  await expect(page).toHaveURL(/\/$/);
  const field = page.getByLabel("چه خریدی؟");
  await expect(field).toBeVisible({ timeout: 30_000 });

  // The one figure is there, and it is the door to the board — there is no
  // other button offering one, so if this link goes the screen is a dead end.
  await expect(page.locator('main a[href="/dashboard"]')).toBeVisible();

  // An amount with nothing said about it opens the form rather than spending
  // a model call on a number a regex already has.
  const amount = "37.61";
  await field.fill(amount);
  await page.getByRole("button", { name: "ثبت", exact: true }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await expect(sheet.getByText("مبلغ را گرفتم")).toBeVisible();
  expect(askedTheModel, "an amount-only entry reached the model").toBe(false);

  // Finish it off and save.
  await sheet.getByRole("button", { name: "خوراک و سوپرمارکت" }).click();
  await sheet.getByRole("button", { name: "ثبت هزینه" }).click();
  await expect(page.getByText(/ثبت شد\./)).toBeVisible({ timeout: 30_000 });

  // The sheet closes itself, and what is behind it is still the field —
  // empty, and still at «/». Someone with three receipts should not have to
  // find their way back between them.
  await expect(sheet).toBeHidden({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/$/);
  await expect(field).toHaveValue("");

  // Put the account back: the row this wrote is removed.
  await page.goto("/transactions");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button").filter({ hasText: amount }).first().click();
  await page.getByRole("button", { name: "حذف" }).click();
  await expect(page.getByText("برگردان")).toBeVisible();
});
