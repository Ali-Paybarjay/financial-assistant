import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AdminAiDayRow,
  AdminAiLatencyRow,
  AdminAiTopUserRow,
  AdminAuditLogRow,
  AdminCategoryUsageRow,
  AdminGuestRow,
  AdminImportRow,
  AdminOverviewRow,
  AdminSignupDayRow,
  AdminUserDetailRow,
  AdminUserRow,
  CategoryRow,
  CronRunRow,
} from "@/lib/supabase/database.types";

/**
 * Every read the panel does.
 *
 * Two rules hold everywhere in this file, and they are the reason it exists as
 * one module rather than as inline queries on eight pages:
 *
 *  1. **The ordinary client.** `createClient()`, with the user's session and
 *     RLS applied — never `createAdminClient()`. The reports are `security
 *     definer` RPCs that check the claim themselves, so the service role's
 *     footprint does not grow by a page.
 *
 *  2. **Explicit columns, never `select("*")`.** A row-level policy cannot hide
 *     a column, so the four tables an admin may read still contain figures that
 *     belong to the user. `select("*")` on `profiles` would pull
 *     `monthly_income_estimate` and `debt_amount` into the panel's props and
 *     into its HTML. Listing columns is how the privacy line in migration 0027
 *     is actually enforced — a star would quietly undo it.
 */

/** What every list needs back: the page, and how many pages there are. */
export type Page<Row> = {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function paginate<Row extends { total_count: number }>(
  rows: Row[] | null,
  page: number,
  pageSize: number,
): Page<Row> {
  const list = rows ?? [];
  // Every row carries the same window count; with no rows there are none.
  const total = list[0]?.total_count ?? 0;
  return {
    rows: list,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * A report that came back empty because the token is stale reads exactly like a
 * report that came back empty because there is nothing to show. The first is a
 * bug the operator can fix in one click; the second is Tuesday. So a refusal
 * throws rather than being smoothed into an empty array.
 */
function unwrap<Row>(what: string, result: { data: Row[] | null; error: { message: string; code?: string } | null }): Row[] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data ?? [];
}

// ---------------------------------------------------------------- overview ---

export async function adminOverview(
  timeZone: string,
  retentionDays: number,
): Promise<AdminOverviewRow | null> {
  const supabase = await createClient();
  const rows = unwrap(
    "admin_overview",
    await supabase.rpc("admin_overview", {
      p_tz: timeZone,
      p_retention_days: retentionDays,
    }),
  );
  return rows[0] ?? null;
}

export async function adminSignupsDaily(
  from: string,
  to: string,
  timeZone: string,
): Promise<AdminSignupDayRow[]> {
  const supabase = await createClient();
  return unwrap(
    "admin_signups_daily",
    await supabase.rpc("admin_signups_daily", { p_from: from, p_to: to, p_tz: timeZone }),
  );
}

// ------------------------------------------------------------------- users ---

export type UserFilters = {
  q?: string;
  kind?: string;
  provider?: string;
  page?: number;
};

export const USERS_PAGE_SIZE = 25;

export async function adminUsers(filters: UserFilters): Promise<Page<AdminUserRow>> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);

  const rows = unwrap(
    "admin_users",
    await supabase.rpc("admin_users", {
      p_q: filters.q?.trim() || null,
      p_kind: filters.kind || "all",
      p_provider: filters.provider || null,
      p_page: page,
      p_page_size: USERS_PAGE_SIZE,
    }),
  );

  return paginate(rows, page, USERS_PAGE_SIZE);
}

export async function adminUserDetail(id: string): Promise<AdminUserDetailRow | null> {
  const supabase = await createClient();
  const rows = unwrap(
    "admin_user_detail",
    await supabase.rpc("admin_user_detail", { p_id: id }),
  );
  return rows[0] ?? null;
}

/**
 * One user's model calls, newest first.
 *
 * Read through the table's admin policy rather than an RPC because there is no
 * aggregation to do — and with an explicit column list, because the policy
 * grants the whole row and this only wants the part about the call.
 */
export async function adminUserUsage(
  userId: string,
  limit = 20,
): Promise<
  Pick<
    {
      id: string;
      feature: string;
      model: string;
      status: string;
      input_tokens: number | null;
      output_tokens: number | null;
      cost_cents: number | null;
      latency_ms: number | null;
      created_at: string;
    },
    | "id"
    | "feature"
    | "model"
    | "status"
    | "input_tokens"
    | "output_tokens"
    | "cost_cents"
    | "latency_ms"
    | "created_at"
  >[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_usage_logs")
    .select(
      "id, feature, model, status, input_tokens, output_tokens, cost_cents, latency_ms, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`ai_usage_logs: ${error.message}`);
  return data ?? [];
}

/**
 * One user's uploads, as metadata.
 *
 * Never `storage_path` (the key to the file) and never `extracted` (what the
 * model read off the receipt, which is the purchase). Size, type and whether
 * it parsed is the whole of what an operator needs.
 */
export async function adminUserMedia(userId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, kind, mime_type, size_bytes, status, error_message, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`media_assets: ${error.message}`);
  return data ?? [];
}

// ---------------------------------------------------------------------- ai ---

export async function adminAiUsageDaily(
  from: string,
  to: string,
  timeZone: string,
): Promise<AdminAiDayRow[]> {
  const supabase = await createClient();
  return unwrap(
    "admin_ai_usage_daily",
    await supabase.rpc("admin_ai_usage_daily", { p_from: from, p_to: to, p_tz: timeZone }),
  );
}

export async function adminAiLatency(
  from: string,
  to: string,
  timeZone: string,
): Promise<AdminAiLatencyRow[]> {
  const supabase = await createClient();
  return unwrap(
    "admin_ai_latency",
    await supabase.rpc("admin_ai_latency", { p_from: from, p_to: to, p_tz: timeZone }),
  );
}

export async function adminAiTopUsers(
  from: string,
  to: string,
  timeZone: string,
  limit = 10,
): Promise<AdminAiTopUserRow[]> {
  const supabase = await createClient();
  return unwrap(
    "admin_ai_top_users",
    await supabase.rpc("admin_ai_top_users", {
      p_from: from,
      p_to: to,
      p_tz: timeZone,
      p_limit: limit,
    }),
  );
}

// ----------------------------------------------------------------- imports ---

export const IMPORTS_PAGE_SIZE = 25;

export async function adminImports(
  status: string,
  page = 1,
  userId?: string,
): Promise<Page<AdminImportRow>> {
  const supabase = await createClient();
  const current = Math.max(1, page);

  const rows = unwrap(
    "admin_imports",
    await supabase.rpc("admin_imports", {
      p_status: status || "all",
      p_user_id: userId ?? null,
      p_page: current,
      p_page_size: IMPORTS_PAGE_SIZE,
    }),
  );

  return paginate(rows, current, IMPORTS_PAGE_SIZE);
}

// ------------------------------------------------------------------ guests ---

export async function adminGuests(retentionDays: number): Promise<AdminGuestRow[]> {
  const supabase = await createClient();
  return unwrap(
    "admin_guests",
    await supabase.rpc("admin_guests", { p_retention_days: retentionDays, p_limit: 100 }),
  );
}

/** The last few sweeps, so «did it run» has an answer on the page. */
export async function adminCronRuns(job = "purge-guests", limit = 10): Promise<CronRunRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cron_runs")
    .select("*")
    .eq("job", job)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`cron_runs: ${error.message}`);
  return data ?? [];
}

// -------------------------------------------------------------- categories ---

export type SystemCategory = Pick<
  CategoryRow,
  "id" | "name_fa" | "slug" | "kind" | "cost_kind" | "icon" | "sort_order"
> & { usage: AdminCategoryUsageRow | null };

/**
 * The 20 system rows, each with how much of the product is standing on it.
 *
 * Joined here rather than in SQL because the two halves have different
 * lifetimes: the category list is read through the ordinary categories policy
 * (every user can see system rows, so no admin grant is involved), while the
 * usage counts span every user's data and need definer rights.
 */
export async function adminSystemCategories(): Promise<SystemCategory[]> {
  const supabase = await createClient();

  const [categories, usage] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name_fa, slug, kind, cost_kind, icon, sort_order")
      .is("user_id", null)
      .order("sort_order", { ascending: true }),
    supabase.rpc("admin_category_usage"),
  ]);

  if (categories.error) throw new Error(`categories: ${categories.error.message}`);
  const counts = new Map(
    unwrap("admin_category_usage", usage).map((row) => [row.category_id, row]),
  );

  return (categories.data ?? []).map((category) => ({
    ...category,
    usage: counts.get(category.id) ?? null,
  }));
}

// ------------------------------------------------------------------- audit ---

export const AUDIT_PAGE_SIZE = 50;

export async function adminAuditLog(page = 1): Promise<Page<AdminAuditLogRow & { total_count: number }>> {
  const supabase = await createClient();
  const current = Math.max(1, page);
  const from = (current - 1) * AUDIT_PAGE_SIZE;

  const { data, error, count } = await supabase
    .from("admin_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE - 1);

  if (error) throw new Error(`admin_audit_log: ${error.message}`);

  const total = count ?? 0;
  return {
    rows: (data ?? []).map((row) => ({ ...row, total_count: total })),
    total,
    page: current,
    pageSize: AUDIT_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
  };
}
