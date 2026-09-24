import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * Acceptance test 4 from the brief: the user uploads a photo of a receipt and
 * the total is read correctly.
 *
 * The fixture deliberately contains a subtotal (54.25), tax (7.05), a tender
 * amount (70.00) and change (8.70) alongside the real total (61.30), because
 * picking the largest number or the last number on the page is exactly how
 * this goes wrong.
 */


// Playwright runs from the project root.
const RECEIPT = join(process.cwd(), "tests", "e2e", "fixtures", "receipt.png");

async function login(page: Page) {
  await page.goto("/login?method=password");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  // The capture screen is the landing page; onboarding still intercepts a new
  // account.
  await page.waitForURL(/\/($|onboarding)/);
}

test("a receipt photo yields its total, not its subtotal or its change", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await login(page);
  await page.goto("/");
  await expect(page.getByLabel("چه خریدی؟")).toBeVisible({ timeout: 30_000 });

  // Drive the hidden gallery input directly; a real camera is not available,
  // and clicking «از گالری» would open a native file dialog Playwright cannot
  // reach. `.first()` is the capture screen's own — ReceiptTab mounts two
  // more once the sheet is open.
  await page
    .locator('input[type="file"]:not([capture])')
    .first()
    .setInputFiles(RECEIPT);

  await expect(page.getByText("کارت تأیید")).toBeVisible({ timeout: 90_000 });

  await expect(page.getByText("$61.30")).toBeVisible();
  await expect(page.getByText("$54.25")).toBeHidden();
  await expect(page.getByText("$70.00")).toBeHidden();

  // One transaction, never one per line item.
  await expect(page.getByRole("button", { name: "ثبت تراکنش" })).toBeVisible();

  // The merchant was printed on the receipt, so it is read rather than
  // guessed. Scoped to the confirm card's own field — the dashboard behind it
  // already lists older Loblaws rows.
  await expect(
    page.getByRole("button", { name: /فروشنده\s+Loblaws/i }),
  ).toBeVisible();
});
