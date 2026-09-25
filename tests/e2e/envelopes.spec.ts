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
  await page.goto("/login?method=password");
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
  //
  // Read off the bar's accessible name rather than the card's text. The one
  // line of copy under the figure has more to say than fits: where part of
  // the spending is still unconfirmed it says *that* instead, so whether the
  // words «از سقف» appear depends on which category the fixture account
  // happens to have an unconfirmed row in that month. The state itself is on
  // the bar in every variant, which is also the thing being asserted.
  const card = page.getByRole("link").filter({ hasText: category }).first();
  await expect(card.getByRole("progressbar", { name: /از سقف رد شده/ })).toBeVisible();

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

/**
 * The bill that must not be asked to have a ceiling.
 *
 * The fixture account posts «اجارهٔ خانه» into «مسکن و اجاره» every month, so
 * the category is on the board with real spending in it — which is exactly
 * the state that used to draw a «سقف نداری» card with a «سقف بگذار» button on
 * it. Rent has one possible answer to «how much do you want to spend», and
 * asking anyway teaches the user that the board asks pointless questions.
 *
 * This asserts the absence of things, which is usually a weak test. It is
 * the right one here: the whole change is that two buttons and one
 * invitation are gone from a specific screen, and a test that only checked
 * the new card would pass with the old prompt sitting beside it.
 */
test("a fixed cost is never asked for a ceiling", async ({ page }) => {
  test.setTimeout(120_000);

  await login(page);
  await page.goto("/dashboard");

  const board = page.getByRole("region").filter({ hasText: "پاکت‌های این ماه" });
  await expect(board.getByText("هزینه‌های ثابت")).toBeVisible();

  // The commitment card: what was paid, and no way to budget for it.
  const rent = page.getByRole("link").filter({ hasText: "مسکن و اجاره" }).first();
  await expect(rent).toBeVisible();
  await expect(rent).not.toContainText("سقف");

  // And the ledger behind it says why there is no ceiling, rather than
  // leaving the missing button to be read as a bug.
  await rent.click();
  await page.waitForURL(/\/transactions\?category=/);
  await expect(page.getByText("هزینه‌ی ثابت")).toBeVisible();
  await expect(page.getByRole("button", { name: "سقف بگذار" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ویرایش سقف" })).toHaveCount(0);

  // A packet of the user's own can say it is a bill too — «قسط ماشین» is as
  // fixed as the rent, and nothing else in the app could work that out.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "+ پاکت" }).click();
  const picker = page.getByRole("dialog");
  await expect(picker.getByRole("tab", { name: "متغیر" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await picker.getByRole("tab", { name: "ثابت" }).click();
  await expect(picker).toContainText("سقف نمی‌خواهد");
});
