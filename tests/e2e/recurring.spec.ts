import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

/**
 * Acceptance test 7: running the recurring job twice creates no duplicates.
 *
 * The guarantee lives in a partial unique index on
 * (recurring_expense_id, posted_month), so it was almost certainly always
 * true — but it had never been exercised, and `post_recurring_for_month` was
 * rewritten to schedule quarterly and yearly bills. Rewriting the function
 * whose idempotency is an acceptance criterion, with nothing asserting that
 * criterion, is how a guarantee quietly stops holding.
 *
 * The test runs against a month far in the past on purpose. Calling it for
 * the current month would return zero simply because the rows are already
 * there, which passes without proving anything: the first call has to insert
 * something for the second call's zero to mean what it says.
 */

const EMAIL = process.env.E2E_EMAIL ?? "alpha@testmail.dev";
const PASSWORD = process.env.E2E_PASSWORD ?? "test-pass-12345";

/** Long before this app existed, so nothing real is disturbed. */
const PAST_MONTH = "2020-01-01";

function env(key: string): string {
  const fromProcess = process.env[key];
  if (fromProcess) return fromProcess;

  const file = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const line = file.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
  const value = line?.slice(key.length + 1).trim();

  if (!value) throw new Error(`${key} is not set and not in .env.local`);
  return value;
}

async function signIn(): Promise<SupabaseClient> {
  const client = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) throw new Error(`could not sign in: ${error.message}`);
  return client;
}

test("running the recurring job twice creates no duplicate rows", async () => {
  test.setTimeout(120_000);

  const supabase = await signIn();

  // Leave nothing behind even if an assertion throws: these are real rows in
  // the user's ledger, in a month they would otherwise never look at.
  async function sweep() {
    await supabase.from("transactions").delete().eq("posted_month", PAST_MONTH);
  }

  await sweep();

  try {
    const first = await supabase.rpc("post_recurring_for_month", {
      p_month: PAST_MONTH,
    });
    expect(first.error).toBeNull();

    // Non-vacuous: if the account had no active auto-posting bill, a second
    // call returning zero would prove nothing at all.
    expect(
      first.data,
      "no rows were generated, so the second call proves nothing",
    ).toBeGreaterThan(0);

    const second = await supabase.rpc("post_recurring_for_month", {
      p_month: PAST_MONTH,
    });
    expect(second.error).toBeNull();
    expect(second.data, "the job generated the same month twice").toBe(0);

    // And the ledger agrees with the count the function reported, which is
    // the thing the user would actually see.
    const { data: rows } = await supabase
      .from("transactions")
      .select("recurring_expense_id")
      .eq("posted_month", PAST_MONTH)
      .is("deleted_at", null);

    expect(rows?.length).toBe(first.data);

    const distinct = new Set((rows ?? []).map((row) => row.recurring_expense_id));
    expect(distinct.size, "one row per bill, not two").toBe(rows?.length);
  } finally {
    await sweep();
  }

  const { data: left } = await supabase
    .from("transactions")
    .select("id")
    .eq("posted_month", PAST_MONTH);
  expect(left ?? [], "the test left rows behind").toEqual([]);
});
