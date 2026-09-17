import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startOfDayUtc, todayInTimeZone } from "@/lib/date";

/** The brief's ceiling, per user per day. */
export const DAILY_CALL_LIMIT = 50;

/**
 * Counts against the user's own midnight, not UTC's. Two requests firing at
 * once can both read a count below the limit and both proceed; that costs a
 * couple of extra calls a day, which is cheaper than serialising every request
 * through a lock.
 */
export async function remainingCalls(timeZone: string): Promise<number> {
  const supabase = await createClient();
  const since = startOfDayUtc(todayInTimeZone(timeZone), timeZone);

  const { count } = await supabase
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString());

  return Math.max(0, DAILY_CALL_LIMIT - (count ?? 0));
}

export type UsageRecord = {
  userId: string;
  feature: "parse_text" | "parse_receipt";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costCents?: number;
  latencyMs?: number;
  status: "ok" | "rejected" | "timeout" | "rate_limit" | "provider" | "malformed";
};

/**
 * Written with the service role because there is deliberately no insert policy
 * on this table — a client that could forge its own usage rows could erase its
 * own rate limit.
 */
export async function logUsage(record: UsageRecord): Promise<void> {
  try {
    await createAdminClient()
      .from("ai_usage_logs")
      .insert({
        user_id: record.userId,
        feature: record.feature,
        provider: "openrouter",
        model: record.model,
        input_tokens: record.inputTokens ?? null,
        output_tokens: record.outputTokens ?? null,
        cost_cents: record.costCents ? Math.round(record.costCents) : null,
        latency_ms: record.latencyMs ?? null,
        status: record.status,
      });
  } catch {
    // Losing a usage row must not fail the user's request. The worst case is
    // an under-counted rate limit, not a lost transaction.
  }
}
