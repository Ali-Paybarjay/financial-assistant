import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * Opening the app lands on the capture screen. Someone whose reason for being
 * here is a trip rather than their own month can point it at «دنگ و دونگ»
 * instead, and point it back.
 *
 * This is worth a test of its own because it changes where the app *starts*.
 * Every other spec signs in and waits for the front door; if the redirect
 * leaks — fires when it should not, or cannot be turned off — it does not
 * break one feature, it breaks the way into all of them.
 *
 * The reset runs in afterEach rather than at the end of the test body, so a
 * failure halfway through cannot leave the fixture account pointed at a
 * workspace that every other spec then trips over.
 */

async function login(page: Page) {
  await page.goto("/login?method=password");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/($|onboarding|dashboard)/);
}

/** The same switch as on the chooser, where it can be found again later. */
const settingsToggle = (page: Page) => page.getByLabel(/باز شدن اپ روی/);

test.afterEach(async ({ page }) => {
  await page.goto("/settings");
  const toggle = settingsToggle(page);
  if (await toggle.isChecked()) await toggle.click();
  await expect(toggle).not.toBeChecked();
});

test("opening the app can be pointed at the trip side, and pointed back", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await login(page);

  // By default the app opens on the field.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("چه خریدی؟")).toBeVisible({ timeout: 30_000 });

  await page.goto("/switch");
  const remember = page.getByLabel(/یک‌راست برو به/);
  await expect(remember).not.toBeChecked();
  await remember.click();
  await expect(remember).toBeChecked();

  // Now opening the app goes straight to the trip side instead. The field
  // writes to the personal ledger, so someone who asked to start in a trip
  // must not be handed it.
  await page.goto("/");
  await page.waitForURL(/\/dong$/);

  // The switch in the header still reaches the chooser, rather than bouncing
  // straight back into the workspace it was pressed in. Filtered to the
  // visible one: it is rendered twice — in the sidebar and in the phone's
  // header strip — and at 375px the sidebar copy is in the DOM but hidden,
  // and it is the one that comes first.
  await page
    .locator('a[href="/switch"]')
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForURL(/\/switch$/);

  // Settings is where someone would look to undo it.
  await page.goto("/settings");
  const toggle = settingsToggle(page);
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();

  // …and the field is the front door again.
  await page.goto("/");
  await expect(page.getByLabel("چه خریدی؟")).toBeVisible();
});
