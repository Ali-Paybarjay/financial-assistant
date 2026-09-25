import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { ALPHA_EMAIL, BETA_EMAIL, PASSWORD, readEnv } from "./credentials";

/**
 * The admin panel's boundary, probed from the wrong side.
 *
 * Written as a sibling of isolation.spec.ts and for the same reason: the thing
 * being tested fails silently and totally. A policy that accidentally reads
 * `is_admin()` as true for everybody looks exactly like a working app — every
 * page renders, every number is right, and every signed-in person can see every
 * other person's email address and every admin report.
 *
 * beta is the whole test. It is an ordinary account with no claim, holding the
 * same anon key a browser holds, asking for everything the panel can ask for.
 * The seed keeps the two fixtures on opposite sides of this on purpose
 * (scripts/seed-e2e.mjs): alpha carries `app_metadata.role = admin` so the
 * smoke suite can open the pages, beta never does.
 *
 * Nothing here writes, with one exception that is value-preserving — the same
 * trick isolation.spec.ts uses, and for the same reason: a test of «you cannot
 * change this» that changes it when it fails is worse than no test.
 */

function env(key: string): string {
  const value = readEnv(key);
  if (!value) throw new Error(`${key} is not set and not in .env.local`);
  return value;
}

async function signIn(email: string): Promise<SupabaseClient> {
  // A fresh client per user: the default one persists its session, and two
  // sharing storage would quietly become one.
  const client = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`could not sign in as ${email}: ${error.message}`);
  return client;
}

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Every report, with arguments harmless enough that a *successful* call would
 * also be harmless — the point is which side of the 42501 it lands on.
 *
 * Appended to as reports are added. A report that is not in this list has never
 * been asked whether it checks the claim.
 */
const ADMIN_RPCS: { name: string; args: Record<string, unknown> }[] = [
  { name: "admin_overview", args: { p_tz: "UTC", p_retention_days: 7 } },
  { name: "admin_signups_daily", args: { p_from: TODAY, p_to: TODAY, p_tz: "UTC" } },
  { name: "admin_users", args: { p_page: 1, p_page_size: 1 } },
  { name: "admin_ai_usage_daily", args: { p_from: TODAY, p_to: TODAY, p_tz: "UTC" } },
  { name: "admin_ai_latency", args: { p_from: TODAY, p_to: TODAY, p_tz: "UTC" } },
  {
    name: "admin_ai_top_users",
    args: { p_from: TODAY, p_to: TODAY, p_tz: "UTC", p_limit: 1 },
  },
  { name: "admin_imports", args: { p_status: "all", p_page: 1, p_page_size: 1 } },
  { name: "admin_guests", args: { p_retention_days: 7, p_limit: 1 } },
  { name: "admin_category_usage", args: {} },
];

/** Postgres's «insufficient privilege», which assert_admin() raises. */
const FORBIDDEN = "42501";

test.describe("the panel is sealed off from an ordinary account", () => {
  test("every report refuses a user with no claim", async () => {
    test.setTimeout(120_000);

    const beta = await signIn(BETA_EMAIL);

    for (const rpc of ADMIN_RPCS) {
      const { error } = await beta.rpc(rpc.name, rpc.args);
      expect(error, `${rpc.name} answered a non-admin`).not.toBeNull();
      expect(error?.code, `${rpc.name} refused for the wrong reason`).toBe(FORBIDDEN);
    }
  });

  test("is_admin() is false for an ordinary account and true for the admin", async () => {
    test.setTimeout(120_000);

    const [alpha, beta] = await Promise.all([signIn(ALPHA_EMAIL), signIn(BETA_EMAIL)]);

    const asBeta = await beta.rpc("is_admin");
    expect(asBeta.error).toBeNull();
    expect(asBeta.data).toBe(false);

    const asAlpha = await alpha.rpc("is_admin");
    expect(asAlpha.error).toBeNull();
    expect(asAlpha.data, "the seed did not give alpha the claim").toBe(true);
  });

  test("the admin tables are invisible without the claim", async () => {
    test.setTimeout(120_000);

    const beta = await signIn(BETA_EMAIL);

    // Select returns [] rather than an error when no policy matches, which is
    // the shape a leak would break: a row coming back is the failure.
    for (const table of ["admin_audit_log", "cron_runs"] as const) {
      const { data, error } = await beta.from(table).select("id").limit(5);
      expect(error, `reading ${table} errored rather than returning nothing`).toBeNull();
      expect(data ?? [], `beta can read ${table}`).toEqual([]);
    }
  });

  test("the admin read policies did not widen anybody else's tables", async () => {
    test.setTimeout(120_000);

    const [alpha, beta] = await Promise.all([signIn(ALPHA_EMAIL), signIn(BETA_EMAIL)]);

    // profiles and ai_usage_logs both gained a permissive admin select policy.
    // Permissive policies OR together, so a mistake in one of them widens the
    // table for *everybody* — which is exactly what this asks.
    //
    // alpha's own id, not «whatever alpha can select»: alpha is the admin
    // fixture, so that query returns every profile in the project including
    // beta's — and beta reading beta is not a leak. The probe has to name a row
    // that belongs to somebody else.
    const {
      data: { user: alphaUser },
    } = await alpha.auth.getUser();
    expect(alphaUser, "alpha has no session").not.toBeNull();

    const { data: own } = await alpha
      .from("profiles")
      .select("id")
      .eq("id", alphaUser!.id);
    expect(own ?? [], "alpha cannot read its own profile").toHaveLength(1);

    const { data: leaked } = await beta
      .from("profiles")
      .select("id")
      .eq("id", alphaUser!.id);
    expect(leaked ?? [], "beta can read alpha's profile").toEqual([]);

    const { data: usage } = await beta.from("ai_usage_logs").select("id").limit(5);
    // beta has never called the model, so its own rows are none either way;
    // what matters is that alpha's do not appear.
    expect(usage ?? [], "beta can read somebody's usage rows").toEqual([]);
  });

  test("an ordinary account cannot forge an audit row", async () => {
    test.setTimeout(120_000);

    const beta = await signIn(BETA_EMAIL);
    const {
      data: { user },
    } = await beta.auth.getUser();

    // Even with its own id in actor_id, which is the half the policy pins.
    const { data, error } = await beta
      .from("admin_audit_log")
      .insert({ actor_id: user!.id, action: "user.delete", target_id: "forged" })
      .select("id");

    expect(error, "beta wrote a row into the audit log").not.toBeNull();
    expect(data ?? []).toEqual([]);
  });

  test("an ordinary account cannot change the app's settings", async () => {
    test.setTimeout(120_000);

    const beta = await signIn(BETA_EMAIL);

    // Readable on purpose — the composer needs to know whether the model is on.
    const { data: before, error: readError } = await beta
      .from("app_settings")
      .select("key, value")
      .eq("key", "ai_enabled")
      .maybeSingle();
    expect(readError).toBeNull();
    expect(before, "app_settings should be readable by any signed-in user").not.toBeNull();

    /**
     * The update writes the value back as it already is.
     *
     * If the policy were broken this would still be a no-op on the data, and
     * the returned row is what catches it — an update that matched something.
     * Turning the model off for every real user is not an acceptable way to
     * discover a bug in a policy.
     */
    const { data: written } = await beta
      .from("app_settings")
      .update({ value: before!.value })
      .eq("key", "ai_enabled")
      .select("key");

    expect(written ?? [], "beta can write app_settings").toEqual([]);
  });

  test("an ordinary account cannot touch a system category", async () => {
    test.setTimeout(120_000);

    const beta = await signIn(BETA_EMAIL);

    // Readable by everyone: system categories have a null user_id and belong to
    // all accounts. Writing them is what the admin policies added.
    const { data: system } = await beta
      .from("categories")
      .select("id, name_fa")
      .is("user_id", null)
      .limit(1)
      .maybeSingle();
    expect(system, "the seed's system categories are missing").not.toBeNull();

    // Value-preserving again, same reasoning as above.
    const { data: updated } = await beta
      .from("categories")
      .update({ name_fa: system!.name_fa })
      .eq("id", system!.id)
      .select("id");
    expect(updated ?? [], "beta can rename a system category").toEqual([]);

    const { error: insertError } = await beta.from("categories").insert({
      user_id: null,
      name_fa: "جعلی",
      slug: `forged-${Date.now()}`,
      kind: "expense",
      is_system: true,
    });
    expect(insertError, "beta can create a system category").not.toBeNull();
  });

  test("an admin can find the panel, and nobody else is shown it", async ({ page }) => {
    test.setTimeout(120_000);

    // The row in settings is the only link to /admin anywhere in the app.
    // Without it the panel is reachable only by typing the address, which is
    // how a finished feature comes to look missing to the person it was built
    // for — so it is worth a test of its own.
    await page.goto("/login?method=password");
    await page.getByLabel("ایمیل").fill(ALPHA_EMAIL);
    await page.getByLabel("رمز").fill(PASSWORD);
    await page.getByRole("button", { name: "ورود", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto("/settings");
    await page.getByRole("link", { name: /پنل مدیریت/ }).click();
    await page.waitForURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "نمای کلی" }),
    ).toBeVisible({ timeout: 20_000 });

    // Hiding the row is not the boundary — middleware and requireAdmin() are,
    // and the tests above cover those. This is about not advertising it.
    await page.context().clearCookies();
    await page.goto("/login?method=password");
    await page.getByLabel("ایمیل").fill(BETA_EMAIL);
    await page.getByLabel("رمز").fill(PASSWORD);
    await page.getByRole("button", { name: "ورود", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto("/settings");
    await expect(page.getByRole("link", { name: /پنل مدیریت/ })).toHaveCount(0);
  });

  test("a signed-out link to /admin keeps its destination through the gate", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // Google is the only real door, and it used to drop `?next=` — so every
    // signed-out deep link in the app landed on «/» instead of where it was
    // pointing. The gate has to put the destination on the url, and the login
    // page has to still be there to hand it to the action.
    await page.goto("/admin", { waitUntil: "domcontentloaded" });

    expect(new URL(page.url()).pathname).toBe("/login");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/admin");
    await expect(page.getByRole("button", { name: "ورود با گوگل" })).toBeVisible();
  });

  test("/admin is a 404 for an account without the claim", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/login?method=password");
    await page.getByLabel("ایمیل").fill(BETA_EMAIL);
    await page.getByLabel("رمز").fill(PASSWORD);
    await page.getByRole("button", { name: "ورود", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    for (const path of ["/admin", "/admin/users", "/admin/settings", "/admin/audit"]) {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });

      // A 404 status *and* the app's own not-found page. The status alone would
      // pass against a route that answered 404 while still rendering the panel,
      // and the text alone would pass against a soft 404 that search engines
      // and monitoring would both treat as a live page.
      expect(response?.status(), `${path} did not answer 404`).toBe(404);
      await expect(
        page.getByRole("heading", { level: 1, name: "این صفحه وجود ندارد" }),
      ).toBeVisible();

      // And nothing of the panel leaked into it.
      await expect(
        page.getByRole("navigation", { name: "ناوبری پنل مدیریت" }),
      ).toHaveCount(0);
    }
  });
});
