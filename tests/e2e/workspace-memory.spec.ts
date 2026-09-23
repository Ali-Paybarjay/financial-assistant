import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * «/» is a chooser, and for someone who only ever opens one side it is a tap
 * paid on every visit to answer a question already answered. It can be told
 * to stop asking.
 *
 * This is worth a test of its own because it changes where the app *starts*.
 * Every other spec signs in and waits for the hub; if the redirect leaks —
 * fires when it should not, or cannot be turned off — it does not break one
 * feature, it breaks the way into all of them.
 *
 * The reset runs in afterEach rather than at the end of the test body, so a
 * failure halfway through cannot leave the fixture account with a default
 * that every other spec then trips over.
 */

async function login(page: Page) {
  await page.goto("/login?method=password");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/($|onboarding|dashboard)/);
}

test.afterEach(async ({ page }) => {
  // «?choose» always shows the chooser, whatever is remembered.
  await page.goto("/?choose=1");
  const undo = page.getByRole("button", { name: "هر بار بپرس" });
  if ((await undo.count()) > 0) await undo.click();
  await expect(page.getByText("همیشه برو به")).toBeVisible();
});

test("the hub can be told to stop asking, and told to start again", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await login(page);

  // By default it asks: both sides are offered and nothing is remembered.
  await page.goto("/?choose=1");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("همیشه برو به")).toBeVisible();

  await page
    .getByRole("button", { name: "حسابداری شخصی", exact: true })
    .click();
  await expect(page.getByText("یک‌راست به")).toBeVisible();

  // Now «/» goes straight through rather than asking again.
  await page.goto("/");
  await page.waitForURL(/\/dashboard/);

  // And the switch in the header still reaches the chooser, rather than
  // bouncing straight back to the workspace it was pressed in.
  await page.getByRole("link", { name: /تعویض/ }).click();
  await page.waitForURL(/\?choose=/);
  await expect(page.getByText("یک‌راست به")).toBeVisible();

  // Settings is where someone would look to undo it.
  await page.goto("/settings");
  const toggle = page.getByLabel("هر بار بپرس کدام بخش");
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();

  await page.goto("/");
  await expect(page.getByText("همیشه برو به")).toBeVisible();
});
