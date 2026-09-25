/**
 * The two accounts tests/e2e signs in as, and the ledger one of them needs.
 *
 * Before this existed the fixtures were rows somebody had made by hand and the
 * suite quietly depended on whatever had accumulated in them — which is how
 * specs came to assert against a dashboard banner that had been deleted, and
 * how a month rolling over could turn a green suite red. Now the suite's
 * starting state is written down, and `pnpm seed:e2e` puts a wiped database
 * back into it.
 *
 * It only ever touches the two @testmail.dev accounts. It deletes and recreates
 * them, so it is safe to run repeatedly and safe to run against a database that
 * has real accounts in it.
 *
 * Usage: pnpm seed:e2e
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const ALPHA = "alpha@testmail.dev";
const BETA = "beta@testmail.dev";

function env(key) {
  if (process.env[key]) return process.env[key];
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const at = line.indexOf("=");
    if (at > 0 && line.slice(0, at).trim() === key) {
      return line.slice(at + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error(`${key} is not set, and .env.local does not define it`);
}

const db = createClient(
  env("NEXT_PUBLIC_SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);

const PASSWORD = env("E2E_PASSWORD");

/** Throws with the Postgres message rather than a bare "failed". */
function ok(what, { error }) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

// ---------------------------------------------------------------- dates ---
// Everything is relative to today, so «this month» stays this month and the
// suite does not go red the morning a month rolls over.

const today = new Date();
const Y = today.getUTCFullYear();
const M = today.getUTCMonth();
const D = today.getUTCDate();

const iso = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** `day` of the month `back` months ago, never later than today. */
function on(back, day) {
  const date = new Date(Date.UTC(Y, M - back, 1));
  const capped = back === 0 ? Math.min(day, D) : day;
  return iso(date.getUTCFullYear(), date.getUTCMonth(), capped);
}

const monthStart = (back) => {
  const date = new Date(Date.UTC(Y, M - back, 1));
  return iso(date.getUTCFullYear(), date.getUTCMonth(), 1);
};

// ---------------------------------------------------------------- users ---

async function recreate(email, fullName, { onboarded, admin = false }) {
  // listUsers is paged; the fixture database is small, one page is plenty.
  const { data: list, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);

  for (const user of list.users) {
    if (user.email === email) {
      ok(`delete ${email}`, await db.auth.admin.deleteUser(user.id));
    }
  }

  // `admin` puts the claim in app_metadata, which is the only thing that makes
  // /admin reachable. alpha carries it so the smoke suite can open the panel's
  // pages at all; beta deliberately does not, and is what admin.spec probes
  // every report and every policy with. Keep them on opposite sides of this:
  // two admin fixtures would leave the negative half of that spec untested.
  const created = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: admin ? { role: "admin" } : undefined,
  });
  ok(`create ${email}`, created);
  const id = created.data.user.id;

  // handle_new_user() made the profile row on insert; this finishes it.
  //
  // `onboarded` is the difference between the two fixtures and it is load
  // bearing both ways. alpha is through the gate, so the suite can reach the
  // app at all. beta is deliberately not: onboarding.spec needs an account
  // that has never finished — that is its whole subject — and isolation.spec
  // leans on the same fact when it checks that a half-set-up account is not
  // handed someone else's figures on the way past a redirect.
  //
  // beta stops at step 1 rather than at 0, because the flow refuses to let
  // anyone skip ahead: from step 0 only step 1 is reachable, and two of
  // onboarding.spec's tests open step 2 directly. «Abandoned partway» is the
  // state that spec describes anyway.
  ok(
    `profile ${email}`,
    await db
      .from("profiles")
      .update({
        full_name: fullName,
        country_code: "CA",
        timezone: "America/Toronto",
        base_currency: "CAD",
        onboarding_step: onboarded ? 6 : 1,
        onboarding_completed_at: onboarded ? new Date().toISOString() : null,
      })
      .eq("id", id),
  );

  return id;
}

// ---------------------------------------------------------------- ledger ---

async function seedAlpha(userId) {
  const { data: categories, error } = await db
    .from("categories")
    .select("id, slug")
    .is("user_id", null);
  if (error) throw new Error(`categories: ${error.message}`);
  const cat = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  const account = await db
    .from("accounts")
    .insert({
      user_id: userId,
      title: "حساب اصلی",
      kind: "checking",
      currency: "CAD",
      opening_balance: 500_000,
      opening_balance_on: monthStart(2),
      is_default: true,
      is_active: true,
    })
    .select("id")
    .single();
  ok("account", account);
  const accountId = account.data.id;

  // A ceiling on groceries, so the dashboard has an envelope to draw — and so
  // the unconfirmed rows below have somewhere to be announced.
  ok(
    "budget",
    await db.from("category_budgets").insert({
      user_id: userId,
      category_id: cat.groceries,
      amount_minor: 60_000,
      currency: "CAD",
      effective_from: monthStart(0),
    }),
  );

  // An auto-posting bill, so post_recurring_for_month() has something to post.
  // recurring.spec calls it for a month in 2020 and asserts the first call
  // inserted something — without a bill here, its second call returning zero
  // would prove nothing, and the spec says so itself.
  ok(
    "recurring",
    await db.from("recurring_expenses").insert({
      user_id: userId,
      title: "اجارهٔ خانه",
      category_id: cat.housing,
      amount: 177_700,
      currency: "CAD",
      frequency: "monthly",
      due_day: 1,
      is_active: true,
      auto_post: true,
      account_id: accountId,
    }),
  );

  ok(
    "goal",
    await db.from("goals").insert({
      user_id: userId,
      title: "صندوق اضطراری",
      type: "emergency_fund",
      target_amount: 1_000_000,
      opening_saved: 200_000,
      priority: 1,
      status: "active",
    }),
  );

  const row = (overrides) => ({
    user_id: userId,
    currency: "CAD",
    account_id: accountId,
    source: "form",
    is_confirmed: true,
    needs_review: [],
    ...overrides,
  });

  const spend = (back, day, category, amount, merchant) =>
    row({
      type: "expense",
      amount,
      category_id: cat[category],
      merchant,
      occurred_on: on(back, day),
    });

  // None of these amounts is one a spec types. A seeded row worth exactly
  // $45.00 makes ai-entry's getByText("$45.00") ambiguous, and the failure
  // reads as the model having got it wrong.
  const transactions = [
    // This month, confirmed.
    spend(0, 3, "groceries", 8_500, "Loblaws"),
    spend(0, 8, "groceries", 12_300, "Metro"),
    spend(0, 12, "groceries", 9_900, "Loblaws"),
    spend(0, 6, "dining", 5_400, "Tim Hortons"),
    spend(0, 14, "transport", 2_800, "TTC"),
    row({
      type: "income",
      amount: 400_000,
      category_id: cat.salary,
      merchant: "حقوق",
      occurred_on: on(0, 1),
    }),

    // This month, unconfirmed — two of them, in a category that has a ceiling,
    // which is what lets the board say so. tests/e2e/dashboard.spec.ts asserts
    // exactly this.
    {
      ...spend(0, 9, "groceries", 4_470, null),
      source: "text",
      is_confirmed: false,
      needs_review: ["category"],
      ai_confidence: 0.55,
    },
    {
      ...spend(0, 15, "groceries", 3_180, null),
      source: "text",
      is_confirmed: false,
      needs_review: ["category"],
      ai_confidence: 0.61,
    },

    // Two earlier months, so six-month series have shape and suggestBudget has
    // the two months of history it refuses to work without.
    spend(1, 5, "groceries", 55_000, "Loblaws"),
    spend(1, 11, "dining", 18_000, "Boustan"),
    spend(1, 19, "transport", 9_000, "Presto"),
    row({
      type: "income",
      amount: 400_000,
      category_id: cat.salary,
      merchant: "حقوق",
      occurred_on: on(1, 1),
    }),
    spend(2, 7, "groceries", 62_000, "Metro"),
    spend(2, 16, "dining", 15_000, "Copper Branch"),
    row({
      type: "income",
      amount: 400_000,
      category_id: cat.salary,
      merchant: "حقوق",
      occurred_on: on(2, 1),
    }),
  ];

  ok("transactions", await db.from("transactions").insert(transactions));
  return transactions.length;
}

// ------------------------------------------------------------------ run ---

const alphaId = await recreate(ALPHA, "کاربر الف", { onboarded: true, admin: true });
const rows = await seedAlpha(alphaId);
console.log(`${ALPHA}: ${rows} transactions, 1 account, 1 goal, 1 budget, admin`);

await recreate(BETA, "کاربر ب", { onboarded: false });
// Deliberately empty and deliberately mid-onboarding: isolation.spec needs a
// second account with nothing in it, and onboarding.spec needs one that has
// never finished.
console.log(`${BETA}: empty and un-onboarded, on purpose`);
