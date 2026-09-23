import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * Acceptance test 2 from the brief: the user writes
 * «۴۵ دلار خرید سوپرمارکت و ۱۲ دلار قهوه» and two transactions with the right
 * categories appear in the confirm card.
 *
 * It used to open the floating button and pick the «متن» tab first. Both are
 * gone: the composer is the text field, on every page, and there is nothing
 * to open. The second test changed with it — a sentence carrying no number
 * never reaches the model at all now, because lib/entry/quick-parse.ts stops
 * it and opens the form instead. See DECISIONS.md.
 *
 * The first test makes a real model call, so it is deliberately short.
 */

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  // The hub is the landing page now; onboarding still intercepts a new account.
  await page.waitForURL(/\/($|onboarding)/);
}

/** The composer's field, which is in the shell rather than on any one page. */
const composer = (page: Page) => page.getByLabel("چه خریدی؟");

test("free text becomes two transactions in the confirm card", async ({ page }) => {
  test.setTimeout(90_000);

  await login(page);
  await page.goto("/dashboard");

  await composer(page).fill("امروز ۴۵ دلار خرید از سوپرمارکت و ۱۲ دلار قهوه");
  await page.getByRole("button", { name: "ثبت", exact: true }).click();

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

test("a sentence with no amount never reaches the model", async ({ page }) => {
  test.setTimeout(60_000);

  await login(page);
  await page.goto("/dashboard");

  // If anything asks the model to read this, the test fails: the whole point
  // of the gate is that text with no number in it costs nothing.
  let asked = false;
  await page.route("**/api/parse/text", async (route) => {
    asked = true;
    await route.abort();
  });

  await composer(page).fill("امروز رفتم خرید کردم");
  await page.getByRole("button", { name: "ثبت", exact: true }).click();

  // The form opens instead, ready for the amount — which is the one field
  // this app never infers.
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("مبلغ")).toBeVisible();
  expect(asked).toBe(false);
});

test("«بنزین ۶۰» reaches the model and comes back with a category", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await login(page);
  await page.goto("/dashboard");

  // The case that sent this back for rework: short, ordinary, and shaped like
  // «amount + a word». The first gate stopped it and opened a form with the
  // amount filled and the category empty — the same work as recording it by
  // hand. The figure was never the hard part; the category is.
  let asked = false;
  await page.route("**/api/parse/text", async (route) => {
    asked = true;
    await route.continue();
  });

  await composer(page).fill("بنزین ۶۰");
  await page.getByRole("button", { name: "ثبت", exact: true }).click();

  await expect(page.getByText("کارت تأیید")).toBeVisible({ timeout: 45_000 });
  expect(asked, "the gate swallowed it instead of asking the model").toBe(true);

  // A category the user never typed, which is the whole point of the call.
  await expect(page.getByText(/حمل‌ونقل|خودرو و سوخت/).first()).toBeVisible();

  // And nothing is written until it is confirmed.
  await expect(page.getByText("تا تأیید نکنی ذخیره نمی‌شود")).toBeVisible();
});
