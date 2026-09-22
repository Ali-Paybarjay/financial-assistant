import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * The two things a fixed bar at the bottom of a phone can quietly break, and
 * the one rule it could quietly violate.
 *
 * None of these are visible to `pnpm verify`. A page whose last row sits two
 * pixels under the composer compiles, lints, type-checks, passes every unit
 * test and renders without throwing — and hides a transaction from the person
 * who just recorded it. That is not hypothetical: `pb-[120px]` was two pixels
 * short of the bar's real height, because the row is sized by its 44px touch
 * targets rather than by the 42px field, and this file is what found it.
 *
 * The clearance is measured against the lowest element that actually draws
 * something, never against <main> — main's border box includes the padding
 * that exists precisely to reserve the bar's space, so measuring that would
 * always report an overlap exactly one bar tall and never notice a real one.
 */

/** Every personal route that renders a list under the bar. */
const ROUTES = ["/dashboard", "/stream", "/transactions", "/goals", "/settings"];

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/($|onboarding|dashboard)/);
}

test("no page scrolls sideways, and nothing hides under the composer", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await login(page);

  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      overflow.scrollWidth,
      `${route} scrolls sideways at ${overflow.clientWidth}px`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 1);

    const clearance = await page.evaluate(() => {
      const bar = document.getElementById("composer-text")?.closest(".fixed");
      const main = document.querySelector("main");
      if (!bar || !main) return null;

      window.scrollTo(0, document.body.scrollHeight);

      let lowest = 0;
      for (const element of main.querySelectorAll("*")) {
        const box = element.getBoundingClientRect();
        if (box.height === 0 || box.width === 0) continue;
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none") continue;
        // Something that draws: text, or a filled background.
        const draws =
          Boolean(element.textContent?.trim()) ||
          style.backgroundColor !== "rgba(0, 0, 0, 0)";
        if (draws && box.bottom > lowest) lowest = box.bottom;
      }
      return { lowest: Math.round(lowest), barTop: Math.round(bar.getBoundingClientRect().top) };
    });

    expect(clearance, `${route} has no composer`).not.toBeNull();
    expect(
      clearance!.lowest,
      `${route} draws content under the composer`,
    ).toBeLessThanOrEqual(clearance!.barTop + 1);
  }
});

test("the trip side has no bar that would write to the personal ledger", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await login(page);

  // Rule 11. The composer records a personal expense, so on a trip page it
  // would take «قهوه ۵» from someone looking at a shared expense list and
  // file it as their own spending. «دنگ و دونگ» records through its own
  // sheet, which knows who paid and how it splits.
  await page.goto("/dong");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#composer-text")).toHaveCount(0);
});
