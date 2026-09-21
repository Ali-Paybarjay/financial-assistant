import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { readEnv } from "./credentials";

/**
 * Guest mode, and the one promise it makes that is worth testing: signing up
 * later keeps everything entered before.
 *
 * The API half is the real test. "Your data survives" is a claim about user
 * ids and foreign keys, not about buttons — it holds because the upgrade is an
 * `updateUser` on the existing anonymous user rather than a fresh signup, and
 * the only way to watch that fail is to look at the rows.
 *
 * The browser half only checks that a guest is told the truth on the way in,
 * which is the other half of the feature and is entirely about the UI.
 *
 * Nothing here reuses a fixture account: every test makes its own guest and
 * deletes it at the end, because a guest that outlives its test is exactly the
 * kind of row purge_stale_guests() exists to sweep up.
 */

function env(key: string): string {
  const value = readEnv(key);
  if (!value) throw new Error(`${key} is not set and not in .env.local`);
  return value;
}

function anonClient(): SupabaseClient {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function adminClient(): SupabaseClient {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signInAsGuest(client: SupabaseClient) {
  const { data, error } = await client.auth.signInAnonymously();
  if (error) {
    throw new Error(
      error.code === "anonymous_provider_disabled"
        ? "Anonymous sign-ins are off for this Supabase project, so guest mode " +
          "cannot work at all. Turn them on under Authentication → Sign In / " +
          "Providers → Anonymous Sign-Ins."
        : `guest sign-in failed: ${error.message}`,
    );
  }
  return data.user!;
}

test("a guest is an ordinary authenticated user with an ordinary profile row", async () => {
  const client = anonClient();
  const user = await signInAsGuest(client);

  try {
    expect(user.is_anonymous).toBe(true);
    // Supabase hands back "" rather than null for a user with no address, which
    // is why lib/auth.ts normalises it before anything downstream asks.
    expect(user.email || null).toBeNull();

    // The on_auth_user_created trigger does not care how the user signed in,
    // which is why no policy in the schema needed changing for guests.
    const { data: profile, error } = await client
      .from("profiles")
      .select("id, onboarding_completed_at")
      .eq("id", user.id)
      .single();

    expect(error).toBeNull();
    expect(profile?.id).toBe(user.id);
    expect(profile?.onboarding_completed_at).toBeNull();
  } finally {
    await adminClient().auth.admin.deleteUser(user.id);
  }
});

/**
 * The shape of the upgrade call, which is not a matter of taste: GoTrue rejects
 * "Updating password of an anonymous user without an email or phone", and a
 * pending email change does not satisfy it either, so setting the two in
 * separate calls fails in BOTH orders. One combined request is the only thing
 * that works, and splitting it again is the regression this catches.
 *
 * It costs one confirmation email and the built-in SMTP allows very few per
 * hour, so an exhausted quota skips rather than fails — that is a fact about
 * the mail service, not about the code. A genuine rejection of the call still
 * fails loudly, which is the entire point of keeping this separate.
 */
test("a guest's email and password have to be set in one call", async () => {
  const client = anonClient();
  const guest = await signInAsGuest(client);

  try {
    const { error } = await client.auth.updateUser({
      email: `guest-shape-${Date.now()}@testmail.dev`,
      password: `pw-${crypto.randomUUID()}`,
    });

    test.skip(
      error?.code === "over_email_send_rate_limit",
      "Supabase's built-in SMTP is out of quota for this hour.",
    );
    expect(error).toBeNull();
  } finally {
    await adminClient().auth.admin.deleteUser(guest.id);
  }
});

/**
 * The promise the login screen makes, end to end.
 *
 * The credentials are set through the admin API rather than over the user's own
 * session on purpose: the session route sends a confirmation email, and a test
 * that burns mail quota cannot run twice in an hour. The test above owns the
 * call shape; this one owns what the user actually cares about, which is a
 * claim about user ids and foreign keys and needs no mail at all.
 */
test("everything a guest entered survives making an account", async () => {
  const client = anonClient();
  const guest = await signInAsGuest(client);
  const email = `guest-upgrade-${Date.now()}@testmail.dev`;
  const password = `pw-${crypto.randomUUID()}`;

  try {
    // Something with a number on it, so a silent re-create shows up as a
    // missing row rather than as an empty-but-present account.
    const { error: writeError } = await client.from("accounts").insert({
      user_id: guest.id,
      title: "کیف پول مهمان",
      kind: "cash",
      currency: "CAD",
      opening_balance: 123_456,
      opening_balance_on: "2026-01-01",
    });
    expect(writeError).toBeNull();

    // Where the user would fill in the form and click the link in their inbox.
    const { data: upgraded, error: upgradeError } = await adminClient().auth.admin.updateUserById(
      guest.id,
      { email, password, email_confirm: true },
    );
    expect(upgradeError).toBeNull();

    // The whole claim in two assertions: same person, no longer a guest.
    expect(upgraded.user?.id).toBe(guest.id);
    expect(upgraded.user?.is_anonymous).toBe(false);

    // And now the part the user actually cares about — sign in the way they
    // will tomorrow, with credentials that did not exist when the row was
    // written, and find their money still there.
    const returning = anonClient();
    const { error: signInError } = await returning.auth.signInWithPassword({ email, password });
    expect(signInError).toBeNull();

    const { data: accounts } = await returning
      .from("accounts")
      .select("title, opening_balance")
      .eq("user_id", guest.id);

    expect(accounts).toHaveLength(1);
    expect(accounts?.[0]).toMatchObject({
      title: "کیف پول مهمان",
      opening_balance: 123_456,
    });
  } finally {
    await adminClient().auth.admin.deleteUser(guest.id);
  }
});

test("deleting a guest takes their rows with it", async () => {
  const client = anonClient();
  const guest = await signInAsGuest(client);

  await client.from("accounts").insert({
    user_id: guest.id,
    title: "موقتی",
    kind: "cash",
    currency: "CAD",
    opening_balance: 1_000,
    opening_balance_on: "2026-01-01",
  });

  // What signing out of a guest account does. If the cascade ever stops
  // reaching a table, the promise on the login screen quietly becomes false.
  const admin = adminClient();
  await admin.auth.admin.deleteUser(guest.id);

  const { data: leftovers } = await admin.from("accounts").select("id").eq("user_id", guest.id);
  expect(leftovers).toEqual([]);

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", guest.id)
    .maybeSingle();
  expect(profile).toBeNull();
});

test("the login screen offers guest entry and states the cost before the tap", async ({
  page,
}) => {
  await page.goto("/login");

  const guestButton = page.getByRole("button", { name: "ورود به‌عنوان مهمان" });
  await expect(guestButton).toBeVisible();
  // The terms belong next to the button, not behind it.
  await expect(page.getByText("اطلاعاتت ذخیره نمی‌ماند")).toBeVisible();

  await guestButton.click();
  await page.waitForURL(/\/onboarding\//);

  // Said once, on the way in...
  await expect(page.getByText("به‌عنوان مهمان وارد شدی")).toBeVisible();
  await page.getByRole("button", { name: "باشه، شروع می‌کنم" }).click();

  // ...and then standing, on every screen, because the notice gets dismissed
  // and forgotten long before the data starts mattering.
  await expect(page.getByText("مهمان هستی؛ اطلاعاتت ذخیره نمی‌ماند.")).toBeVisible();

  await page.getByRole("link", { name: "حساب بساز" }).click();
  await page.waitForURL(/\/save-account/);
  await expect(page.getByText("چیزی از نو شروع نمی‌شود")).toBeVisible();
});

test("a guest is warned that leaving is permanent, and can back out", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "ورود به‌عنوان مهمان" }).click();
  await page.waitForURL(/\/onboarding\//);
  await page.getByRole("button", { name: "باشه، شروع می‌کنم" }).click();

  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await expect(page.getByText("با خروج، اطلاعاتت پاک می‌شود")).toBeVisible();
  // The exit sheet is the last moment this offer is any use.
  await expect(page.getByRole("link", { name: "اول حساب بسازم" })).toBeVisible();

  await page.getByRole("button", { name: "ادامه‌ی ثبت‌نام" }).click();
  await expect(page).toHaveURL(/\/onboarding\//);

  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await page.getByRole("button", { name: "خروج و حذف" }).click();
  await page.waitForURL(/\/login/);

  // The session is really gone, not just navigated away from.
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
});
