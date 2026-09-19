import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { ALPHA_EMAIL, BETA_EMAIL, PASSWORD, readEnv } from "./credentials";

/**
 * Acceptance test 6: the second user sees nothing of the first — not in the
 * UI, and not by calling the API directly.
 *
 * PLAN.md asked for this at the end of every milestone and it was never
 * automated. It is the one invariant in the product with real consequences
 * and no test: row-level security is the only thing standing between two
 * people's money, and unlike every other rule here it fails silently and
 * totally.
 *
 * The API half is the real test. It signs in as each user with the same
 * anon key the browser uses and asks, row by row, for things that belong to
 * the other — which is exactly what an attacker with a valid account would
 * do. The UI half is a weaker claim (the second account has not finished
 * onboarding, so most routes redirect), kept because the acceptance
 * criterion names both.
 *
 * Nothing here writes. The one write probe is value-preserving on purpose:
 * see `cannot write to the other user's row` below.
 */

/** `readEnv` from credentials.ts, made to throw instead of returning undefined. */
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

  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`could not sign in as ${email}: ${error.message}`);
  return client;
}

/** Every table that holds something belonging to one person. */
const OWNED_TABLES = [
  "transactions",
  "goals",
  "accounts",
  "income_sources",
  "recurring_expenses",
  "variable_expense_baselines",
  "statement_imports",
  "dong_groups",
  "profiles",
] as const;

test.describe("a second user is sealed off from the first", () => {
  test("cannot read the other user's rows, by id, in any table", async () => {
    test.setTimeout(120_000);

    const alpha = await signIn(ALPHA_EMAIL);
    const beta = await signIn(BETA_EMAIL);

    for (const table of OWNED_TABLES) {
      // What alpha actually has. Asking beta for a row that does not exist
      // would pass against a database with no policies at all, so the probe
      // has to name something real.
      const { data: mine, error } = await alpha.from(table).select("id").limit(5);
      expect(error, `alpha could not read its own ${table}`).toBeNull();

      const ids = (mine ?? []).map((row) => row.id as string);
      if (ids.length === 0) continue; // Nothing to hide in this table yet.

      const { data: leaked } = await beta.from(table).select("id").in("id", ids);
      expect(leaked ?? [], `beta can read alpha's ${table}`).toEqual([]);
    }
  });

  test("cannot reach the other user's money through the derived-total functions", async () => {
    test.setTimeout(120_000);

    const alpha = await signIn(ALPHA_EMAIL);
    const beta = await signIn(BETA_EMAIL);

    // These run `security invoker` and filter on auth.uid() themselves. If
    // either were ever changed to `security definer` without keeping the
    // filter, every balance in the product would be readable by anyone.
    const [alphaBalances, alphaGoals] = await Promise.all([
      alpha.rpc("account_balances"),
      alpha.rpc("goal_progress"),
    ]);
    const [betaBalances, betaGoals] = await Promise.all([
      beta.rpc("account_balances"),
      beta.rpc("goal_progress"),
    ]);

    const alphaAccountIds = new Set(
      (alphaBalances.data ?? []).map((row: { account_id: string }) => row.account_id),
    );
    const alphaGoalIds = new Set(
      (alphaGoals.data ?? []).map((row: { goal_id: string }) => row.goal_id),
    );

    for (const row of betaBalances.data ?? []) {
      expect(alphaAccountIds.has(row.account_id), "account_balances leaked").toBe(false);
    }
    for (const row of betaGoals.data ?? []) {
      expect(alphaGoalIds.has(row.goal_id), "goal_progress leaked").toBe(false);
    }
  });

  test("cannot write to the other user's row", async () => {
    test.setTimeout(120_000);

    const alpha = await signIn(ALPHA_EMAIL);
    const beta = await signIn(BETA_EMAIL);

    const { data: goal } = await alpha
      .from("goals")
      .select("id, title")
      .limit(1)
      .maybeSingle();
    test.skip(!goal, "alpha has no goal to aim at");

    /**
     * The update writes the title back as it already is.
     *
     * A test of «you cannot change my data» that changes the data when it
     * fails is worse than no test: the run that catches the bug is the run
     * that does the damage. Writing the value it already holds means a
     * broken policy is caught by the returned row — an update that matched
     * something — while the row itself is untouched either way.
     *
     * Delete is not probed for the same reason, and cannot be made safe.
     *
     * Verified by running this file with both accounts set to the same user:
     * all four tests fail, this one included, and the goal comes out with the
     * same title, amounts and status — only `updated_at` moves, and only on
     * the broken path, because a healthy policy matches no row and never
     * fires the trigger at all.
     */
    const { data: written } = await beta
      .from("goals")
      .update({ title: goal!.title })
      .eq("id", goal!.id)
      .select("id");

    expect(written ?? [], "beta can write to alpha's goal").toEqual([]);

    // And the row is still alpha's, unchanged.
    const { data: after } = await alpha
      .from("goals")
      .select("title")
      .eq("id", goal!.id)
      .maybeSingle();
    expect(after?.title).toBe(goal!.title);
  });

  test("shows the first user nothing of theirs in the browser", async ({ page }) => {
    test.setTimeout(120_000);

    const alpha = await signIn(ALPHA_EMAIL);
    const { data: goals } = await alpha.from("goals").select("title").limit(5);
    const titles = (goals ?? []).map((row) => row.title as string).filter(Boolean);
    test.skip(titles.length === 0, "alpha has no goal to look for");

    await page.goto("/login");
    await page.getByLabel("ایمیل").fill(BETA_EMAIL);
    await page.getByLabel("رمز").fill(PASSWORD);
    await page.getByRole("button", { name: "ورود", exact: true }).click();
    await page.waitForURL(/\/(dashboard|onboarding)/);

    // The second account has not finished onboarding, so these mostly
    // redirect — which is itself the point: there is no route that hands it
    // someone else's figures on the way past.
    for (const route of ["/dashboard", "/goals", "/transactions", "/accounts"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const body = await page.locator("body").innerText();
      for (const title of titles) {
        expect(body, `«${title}» leaked into ${route}`).not.toContain(title);
      }
    }
  });
});
