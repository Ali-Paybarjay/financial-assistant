import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { startOfDayUtc, todayInTimeZone } from "@/lib/date";

/** The brief's ceiling, per user per day. */
export const DAILY_CALL_LIMIT = 50;

/**
 * What a guest gets instead.
 *
 * The ceiling above caps a user, and a guest account costs one tap and no
 * email — so for anyone willing to sign out and back in it caps nothing at
 * all, while every call past it is real money at the provider. A smaller
 * allowance keeps the feature demonstrable, which is the entire point of guest
 * mode: enough to photograph a receipt, watch the app read it, and decide the
 * thing is worth an account.
 *
 * This narrows the hole rather than closing it. Closing it means a captcha on
 * anonymous sign-ins, which is a Supabase project setting and not something
 * this file can do.
 */
export const GUEST_DAILY_CALL_LIMIT = 5;

export type Allowance = {
  remaining: number;
  /** What the ceiling was, so the message that reports it can say a true number. */
  limit: number;
  isGuest: boolean;
};

/**
 * Counts against the user's own midnight, not UTC's. Two requests firing at
 * once can both read a count below the limit and both proceed; that costs a
 * couple of extra calls a day, which is cheaper than serialising every request
 * through a lock.
 */
export async function remainingCalls(timeZone: string): Promise<Allowance> {
  const supabase = await createClient();
  const user = await getSessionUser();
  const since = startOfDayUtc(todayInTimeZone(timeZone), timeZone);

  const isGuest = user?.is_anonymous === true;
  const limit = isGuest ? GUEST_DAILY_CALL_LIMIT : DAILY_CALL_LIMIT;

  const { count } = await supabase
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString());

  return { remaining: Math.max(0, limit - (count ?? 0)), limit, isGuest };
}

export type UsageRecord = {
  userId: string;
  feature: "parse_text" | "parse_receipt" | "parse_statement";
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
