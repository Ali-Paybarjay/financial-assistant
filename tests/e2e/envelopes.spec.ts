import { expect, test, type Page } from "@playwright/test";
import { ALPHA_EMAIL as EMAIL, PASSWORD } from "./credentials";

/**
 * A ceiling turns a category into an envelope, and the board says so.
 *
 * The unit tests in tests/unit/envelopes.spec.ts prove the arithmetic; what
 * they cannot prove is that the number reaches the card. This drives the real
 * loop — sheet, server action, SQL function, board, and the detail page a
 * card links to — because every one of those can be green on its own while
 * the board still shows nothing.
 *
 * It sets a deliberately tiny ceiling so the category lands over budget, and
 * checks the sentence the sheet shows *before* saving. That sentence is the
 * one thing here a user cannot find out any other way: without it they
 * discover they were already over a month later.
 *
 * It removes the ceiling at the end, so the account is left as it was found.
 */

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill(EMAIL);
  await page.getByLabel("رمز").fill(PASSWORD);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await page.waitForURL(/\/($|onboarding)/);
}

test("a ceiling says what it does before it is saved, then draws the envelope", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await login(page);
  await page.goto("/dashboard");

  // Any category the account spent in this month and has no ceiling on. The
  // board puts these last, full width, each with this invitation on it.
  const invite = page.getByRole("button", { name: "سقف بگذار" }).first();
  await expect(invite).toBeVisible();

  await invite.click();

  // The sheet has to name the envelope it is about, or the user cannot tell
  // which one they are budgeting.
  const sheet = page.getByRole("dialog");
  const title = await sheet.getByRole("heading").first().innerText();
  const category = title.replace(/^سقف\s*«|»$/g, "").trim();
  expect(category.length).toBeGreaterThan(0);

  // One whole unit of the account's currency. There is real spending in this
  // category, so this is certainly over — which is the state worth being
  // warned about while still typing.
  await sheet.getByLabel("سقف ماهانه").fill("1");
  await expect(sheet).toContainText("رد شده‌ای");

  await sheet.getByRole("button", { name: "سقف را بگذار" }).click();
  await expect(sheet).toBeHidden();

  // It is a real envelope now, and it reports being over its ceiling.
  const card = page.getByRole("link").filter({ hasText: category }).first();
  await expect(card).toContainText("از سقف");

  // Tapping it opens the ledger filtered to that category — the other half
  // of the feature, and the only route to the editor.
  await card.click();
  await page.waitForURL(/\/transactions\?category=/);
  await expect(page.getByText("از سقف رد شده")).toBeVisible();

  // Put the account back the way it was found.
  await page.getByRole("button", { name: "ویرایش سقف" }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("button", { name: "بردار" }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByText("سقف نداری")).toBeVisible();
});

test("a packet can be added from the list, invented, and taken off for good", async ({
  page,
}) => {
  test.setTimeout(150_000);

  await login(page);
  await page.goto("/dashboard");

  const board = page.getByRole("region").filter({ hasText: "پاکت‌های این ماه" });
  const named = (name: string) =>
    page.getByRole("link").filter({ hasText: name }).first();

  // ---- add one from the list ---------------------------------------------
  await page.getByRole("button", { name: "+ پاکت" }).click();
  const picker = page.getByRole("dialog");
  // The chips are list items; the «+» beside each one is an icon, not text.
  const first = picker.getByRole("listitem").first().getByRole("button");
  const addedName = (await first.innerText()).trim();
  expect(addedName.length).toBeGreaterThan(0);
  await first.click();
  await expect(picker).toBeHidden();
  await expect(board).toContainText(addedName);

  // ---- invent one with a name of your own --------------------------------
  const invented = `پاکت تست ${Date.now().toString().slice(-5)}`;
  await page.getByRole("button", { name: "+ پاکت" }).click();
  await page.getByLabel("یا یک پاکت با نام خودت").fill(invented);
  await page.getByRole("button", { name: "بساز و بگذار روی بورد" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(board).toContainText(invented);

  // ---- and take both off, which has to beat every reason to show them -----
  for (const name of [invented, addedName]) {
    await page.goto("/dashboard");
    await named(name).click();
    await page.waitForURL(/\/transactions\?category=/);
    await page.getByRole("button", { name: "حذف از بورد" }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(board).not.toContainText(name);
  }

  // Taking a packet off the board hides the card; the category it was made
  // from is still a real category, so the invented one is deleted here or it
  // accumulates on the fixture account one per run.
  await page.goto("/settings");
  await page.getByRole("button", { name: "دسته‌ها" }).click();
  const categories = page.getByRole("dialog");
  await categories.getByRole("button", { name: `حذف ${invented}` }).click();
  await expect(
    categories.getByRole("button", { name: `حذف ${invented}` }),
  ).toBeHidden();
});
