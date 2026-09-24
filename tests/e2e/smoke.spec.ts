import { expect, test, type Locator, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * Every route, opened once.
 *
 * This suite asserts almost nothing about what the pages do. It asserts that
 * they come up — and that is exactly the gap it exists to close. `pnpm
 * verify` and the workflow beside it run typecheck, lint, check:rtl, unit
 * tests and a build, and not one of them ever loads a page. A route that
 * compiles and then throws while rendering passes all five.
 *
 * That is not hypothetical. On 2026-09-21 the hub — the first screen after
 * signing in — rendered its error boundary, because a server component read
 * a map of components exported from a "use client" module and got undefined
 * back. Typecheck green, lint green, build green, preview deployment green.
 * Nobody knew until a test opened the page.
 *
 * So this is deliberately cheap and deliberately complete: it visits every
 * route the app has and writes nothing, which is what lets it run on every
 * pull request rather than by hand.
 *
 * Three checks per route, because a page can fail in three ways that do not
 * look alike:
 *
 *   * the response status, for a server that refused outright;
 *   * the error boundary's own heading, for a server component that threw —
 *     the dev server answers 200 and serves the boundary's HTML, so a status
 *     check alone would call that a pass;
 *   * an uncaught exception in the browser, for a component that breaks
 *     after hydration, which leaves both the status and the markup fine.
 *
 * Failures are collected rather than thrown at the first one. When something
 * shared breaks, every route breaks, and the list says so — where the first
 * failure alone would send you looking at one page.
 */

/** The heading app/(app)/error.tsx renders. */
const ERROR_BOUNDARY = "این صفحه بالا نیامد";

type Route = {
  path: string;
  /** What is being looked for, in the words of the failure message. */
  shows: string;
  /** Proof that this page rendered, and not some other page. */
  landmark: (page: Page) => Locator;
};

/** The page's own <h1>. Nav labels are not headings, so this cannot match one. */
const heading =
  (name: string) =>
  (page: Page): Locator =>
    page.getByRole("heading", { level: 1, name });

const PUBLIC_ROUTES: Route[] = [
  { path: "/login", shows: "خوش آمدی", landmark: heading("خوش آمدی") },
  // Email is off for now (lib/auth-methods.ts), so both of these land on
  // the login page. Kept in the list so the redirect itself is what gets
  // checked; when email comes back, they go back to their own headings.
  { path: "/signup", shows: "خوش آمدی", landmark: heading("خوش آمدی") },
  { path: "/forgot-password", shows: "خوش آمدی", landmark: heading("خوش آمدی") },
  // /reset-password is left out: it is only reachable with a recovery token,
  // and a smoke test that signs itself in cannot hold one.
];

const SIGNED_IN_ROUTES: Route[] = [
  {
    path: "/",
    shows: "the capture field",
    landmark: (page) => page.getByLabel("چه خریدی؟"),
  },
  {
    path: "/switch",
    // The chooser's heading is «سلام <name>», which is the one thing on it
    // that depends on the account. Its two boxes do not.
    shows: "the two workspace boxes",
    landmark: (page) => page.locator('main a[href="/dong"]'),
  },
  {
    path: "/dashboard",
    // Not the <h1>: on the dashboard it lives in a header that only exists
    // from 960px, so at the 375px this suite runs at there is no visible
    // level-1 heading at all.
    //
    // The balance card used to be labelled «مانده‌ی این ماه» and now names
    // the month it is showing — «ماندهٔ سپتامبر» — because the card is no
    // longer always about the current month. So the label is matched by its
    // stable half, which is in both of the page's states.
    shows: "ماندهٔ <ماه>",
    landmark: (page) => page.getByText(/ماندهٔ\s/).first(),
  },
  { path: "/transactions", shows: "تراکنش‌ها", landmark: heading("تراکنش‌ها") },
  { path: "/accounts", shows: "حساب‌ها", landmark: heading("حساب‌ها") },
  {
    path: "/income",
    shows: "درآمد و هزینه‌ی ثابت",
    landmark: heading("درآمد و هزینه‌ی ثابت"),
  },
  { path: "/goals", shows: "هدف‌ها", landmark: heading("هدف‌ها") },
  {
    path: "/import",
    shows: "صورت‌حساب بانکی",
    landmark: heading("صورت‌حساب بانکی"),
  },
  { path: "/settings", shows: "تنظیمات", landmark: heading("تنظیمات") },
  {
    path: "/settings/risk",
    // The heading here is whichever question comes next, so the landmark is
    // the label above it.
    shows: "ریسک‌پذیری",
    landmark: (page) => page.getByText("ریسک‌پذیری").first(),
  },
  { path: "/dong", shows: "دنگ و دونگ", landmark: heading("دنگ و دونگ") },
];

async function login(page: Page) {
  await page.goto("/login?method=password");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  // Wherever it lands — the hub, or onboarding for an account that never
  // finished it — as long as it is no longer the login page.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Everything wrong with one page, in the words someone would need. */
async function visit(
  page: Page,
  route: Route,
  crashes: string[],
): Promise<string[]> {
  crashes.length = 0;
  const problems: string[] = [];

  const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  if (status >= 400) {
    problems.push(`${route.path} answered ${status}`);
  }

  if ((await page.getByText(ERROR_BOUNDARY).count()) > 0) {
    problems.push(`${route.path} rendered the error boundary («${ERROR_BOUNDARY}»)`);
  } else {
    try {
      await expect(route.landmark(page)).toBeVisible({ timeout: 15_000 });
    } catch {
      problems.push(
        `${route.path} never showed ${route.shows} — ended up at ${page.url()}`,
      );
    }
  }

  // Every page names itself to someone navigating by headings. Asserted for
  // the same reason the rest of this file exists: the dashboard lost its own
  // for a while — the heading was inside a row that only exists from 960px,
  // so on a phone the screen the app opens on had none at all — and nothing
  // in the project could see that.
  if ((await page.getByRole("heading", { level: 1 }).count()) === 0) {
    problems.push(`${route.path} has no level-1 heading`);
  }

  if (crashes.length > 0) {
    problems.push(`${route.path} threw in the browser: ${crashes[0]}`);
  }

  return problems;
}

test("every page comes up", async ({ page }) => {
  test.setTimeout(180_000);

  // Uncaught exceptions, per route: a page can answer 200, render its
  // markup, and still be broken the moment React takes over.
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));

  const failures: string[] = [];

  for (const route of PUBLIC_ROUTES) {
    failures.push(...(await visit(page, route, crashes)));
  }

  await login(page);

  for (const route of SIGNED_IN_ROUTES) {
    failures.push(...(await visit(page, route, crashes)));
  }

  // One group's own page, when the account has a group to open. Not created
  // here: this suite writes nothing, and a route that cannot be reached
  // without inventing data is not this suite's to cover — tests/e2e/dong.spec.ts
  // opens one for real.
  await page.goto("/dong");
  const firstGroup = page.locator('main a[href^="/dong/"]').first();
  if ((await firstGroup.count()) > 0) {
    crashes.length = 0;
    await firstGroup.click();
    if ((await page.getByText(ERROR_BOUNDARY).count()) > 0) {
      failures.push("a group's page rendered the error boundary");
    } else {
      try {
        await expect(page.getByRole("tab", { name: "خریدها" })).toBeVisible({
          timeout: 15_000,
        });
      } catch {
        failures.push(`a group's page never came up — ended at ${page.url()}`);
      }
    }
    if (crashes.length > 0) {
      failures.push(`a group's page threw in the browser: ${crashes[0]}`);
    }
  }

  expect(failures.join("\n") || "every page came up").toBe("every page came up");
});
