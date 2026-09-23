import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * Two themes, one set of meanings.
 *
 * The stylesheet hangs everything off `<html data-theme>`, so the failure
 * modes are all invisible to the other gates: a colour that was written as a
 * literal rather than a token stays put when the ground moves, and a
 * foreground chosen for one theme (`text-white` on the accent) becomes
 * unreadable in the other without anything erroring.
 *
 * So this checks the mechanism rather than the appearance — that the
 * attribute lands, that the variables actually change with it, that the
 * choice survives a reload, and that no page throws in either theme.
 */

const ROUTES = ["/dashboard", "/transactions", "/goals", "/settings", "/settings/appearance"];

async function login(page: Page) {
  await page.goto("/login?method=password");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/($|onboarding|dashboard)/);
}

/** What the stylesheet actually resolved, not what we asked for. */
async function resolved(page: Page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      attr: document.documentElement.dataset.theme,
      paper: style.getPropertyValue("--paper").trim(),
      action: style.getPropertyValue("--action").trim(),
    };
  });
}

test("the theme can be chosen, and it sticks", async ({ page }) => {
  test.setTimeout(150_000);

  await login(page);
  await page.goto("/settings/appearance");

  // The radio itself is sr-only — a 1px clipped box Playwright will not
  // click. The label is what a person taps, and it wraps the input.
  const option = (name: string) =>
    page.locator("label").filter({ hasText: name }).first();

  await option("تیره").click();
  await expect
    .poll(async () => (await resolved(page)).attr, { timeout: 10_000 })
    .toBe("dark");

  const dark = await resolved(page);
  expect(dark.paper).toBe("#101120");

  // A reload is the real test: it proves the cookie was written and that the
  // server rendered the right theme rather than the client repainting it.
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect((await resolved(page)).attr).toBe("dark");

  // And the two themes are genuinely different values, not one set of
  // literals under a renamed attribute.
  await option("روشن").click();
  await expect
    .poll(async () => (await resolved(page)).paper, { timeout: 10_000 })
    .toBe("#edecf2");

  const light = await resolved(page);
  expect(light.action).not.toBe(dark.action);
});

for (const theme of ["light", "dark"] as const) {
  test(`every page comes up in the ${theme} theme`, async ({ page, context }) => {
    test.setTimeout(150_000);

    await context.addCookies([
      { name: "theme", value: theme, url: "http://localhost:3100" },
    ]);
    await login(page);

    const broken: string[] = [];
    page.on("pageerror", (error) => broken.push(`threw: ${error.message}`));

    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const state = await resolved(page);
      expect(state.attr, `${route} lost data-theme`).toBe(theme);

      // The error boundary's own heading, because a server component that
      // throws still answers 200 and serves the boundary's markup.
      await expect(
        page.getByRole("heading", { name: "این صفحه بالا نیامد" }),
        `${route} rendered the error boundary in ${theme}`,
      ).toHaveCount(0);
    }

    expect(broken.join("\n")).toBe("");
  });
}

/**
 * Leaving used to mean going somewhere first — the hub, or a row near the
 * bottom of settings. The shell is on every signed-in screen, so the way out
 * is now wherever the user is.
 */
test("the way out is on every page", async ({ page }) => {
  test.setTimeout(150_000);
  await login(page);

  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("button", { name: "خروج" }).first(),
      `${route} offers no way out`,
    ).toBeVisible();
  }

  // Including the trip side, which has no tab bar and no settings page of
  // its own — the place it was hardest to leave from.
  await page.goto("/dong");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "خروج" }).first()).toBeVisible();
});
