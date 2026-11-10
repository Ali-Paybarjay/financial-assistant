import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { startOfDayUtc, todayInTimeZone } from "@/lib/date";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { appSettings } from "@/lib/settings-server";

/** The three routes that cost money. */
export type AiFeature = "parse_text" | "parse_receipt" | "parse_statement";

/**
 * The ceiling, per user per day, per feature.
 *
 * It used to be one number across all three routes, which was right while
 * every model call started with a deliberate tap on a floating button. The
 * composer changes that: text entry is now the fastest path in the app and
 * will be used dozens of times a day, while a bank statement is a monthly
 * chore that costs an order of magnitude more per call.
 *
 * One shared ceiling has to be set for the most expensive of those and then
 * applies to the cheapest, so it either throttles ordinary typing or leaves
 * the expensive path far too loose. Per-feature ceilings let each one be set
 * against what it actually costs. The worst case rises from 50 calls to 85,
 * and gets *cheaper*, because 50 statement parses cost many times what
 * 60 text parses plus 20 receipts plus 5 statements do.
 *
 * These are now the *defaults*. `app_settings.ai_daily_limits` can override
 * them without a deploy — see lib/settings.ts and lib/settings-server.ts — and falls back to exactly
 * these numbers whenever it cannot.
 */
export const FEATURE_DAILY_LIMITS: Record<AiFeature, number> =
  DEFAULT_SETTINGS.ai_daily_limits;

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
 * Three rather than five, and the reasoning is arithmetic rather than taste.
 * Supabase caps anonymous sign-ins at 10 an hour project-wide, so this number
 * is the second half of the farm's ceiling: 10 guests x 3 calls is at most 30
 * parses an hour, which is pennies at the provider. It was 30 x 5, or 150.
 *
 * The other way to close this is a captcha on anonymous sign-ins. That is a
 * Supabase project setting, it applies to every auth endpoint rather than just
 * this one, and turning it on would stop the whole e2e suite from being able
 * to sign in — which is a worse trade than a few cents an hour. See
 * DECISIONS.md.
 */
export const GUEST_DAILY_CALL_LIMIT = DEFAULT_SETTINGS.guest_daily_calls;

export type Reservation = {
  /**
   * The usage row this call was claimed against, or null when no call may be
   * made — the ceiling is reached, the model is switched off, or the
   * reservation itself failed. A null id means «do not call the provider».
   */
  id: string | null;
  allowance: Allowance;
};

export type Allowance = {
  remaining: number;
  /** What the ceiling was, so the message that reports it can say a true number. */
  limit: number;
  isGuest: boolean;
  /**
   * The model is switched off for everybody, not this user's ceiling reached.
   * A different sentence, because «wait until tomorrow» is false advice when
   * the answer is «the operator turned it off».
   */
  disabled: boolean;
};

/**
 * Claim one call before making it.
 *
 * Counting and then calling is not a limit. Two requests arriving together both
 * read a count below the ceiling, both proceed and both spend — and the window
 * here is a whole day wide, so a client firing n requests at once got n calls
 * whatever the ceiling said. The count is now taken and the usage row written in
 * one database transaction under a per-user lock (migration 0033), and the
 * caller settles that row afterwards with what the call actually cost.
 *
 * The old count also never said whose calls it was counting: it filtered by date
 * and feature and left the user to RLS, which is right for an ordinary user and
 * wrong for an admin, whose read policy on `ai_usage_logs` covers everybody's
 * rows. The function counts `user_id = auth.uid()` explicitly. F12.
 *
 * A guest is still capped across all three features at once rather than per
 * feature: their ceiling exists to keep the demo affordable for an account that
 * costs one tap to make, and three of each would be three times the number that
 * was actually reasoned about.
 *
 * This is also the single checkpoint in front of every model call — both
 * lib/ai/parse.ts and lib/ai/statement.ts go through it — which is why the kill
 * switch is read here rather than on the three routes. A switch with three
 * implementations is a switch that is off in two places.
 */
export async function reserveCall(
  timeZone: string,
  feature: AiFeature,
  model: string,
): Promise<Reservation> {
  const supabase = await createClient();
  const user = await getSessionUser();
  const since = startOfDayUtc(todayInTimeZone(timeZone), timeZone);

  const isGuest = user?.is_anonymous === true;

  // One primary-key read on a five-row table, on a path that is about to make a
  // model call — which is the expensive half by orders of magnitude.
  const settings = await appSettings();

  if (!settings.ai_enabled) {
    return {
      id: null,
      allowance: { remaining: 0, limit: 0, isGuest, disabled: true },
    };
  }

  const limit = isGuest ? settings.guest_daily_calls : settings.ai_daily_limits[feature];

  const { data, error } = await supabase.rpc("reserve_ai_call", {
    p_feature: feature,
    p_limit: limit,
    p_since: since.toISOString(),
    p_per_feature: !isGuest,
    p_model: model,
  });

  if (error || !data?.[0]) {
    /**
     * The reservation could not be taken, so no call is made.
     *
     * Failing closed is the whole point: the previous code treated a failed
     * count as zero calls used, so the one condition under which the ceiling was
     * most likely to be wrong was also the one under which it was ignored. A
     * refusal costs the user a retry; the other direction costs money at the
     * provider with nothing recording it.
     */
    return {
      id: null,
      allowance: { remaining: 0, limit, isGuest, disabled: false },
    };
  }

  const row = data[0];

  return {
    id: row.reservation_id,
    allowance: {
      remaining: row.allowed ? Math.max(0, limit - row.used - 1) : 0,
      limit,
      isGuest,
      disabled: false,
    },
  };
}

export type UsageRecord = {
  feature: AiFeature;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costCents?: number;
  latencyMs?: number;
  status: "ok" | "rejected" | "timeout" | "rate_limit" | "provider" | "malformed";
};

/**
 * Write what the call turned out to cost onto the row that reserved it.
 *
 * Written with the service role because there is deliberately no insert or
 * update policy on this table — a client that could forge its own usage rows
 * could erase its own rate limit.
 *
 * A reservation that is never settled stays at `reserved` and still counts
 * against the day. That is the safe direction: the request either died
 * mid-flight or the provider was called and this write failed, and in both cases
 * the money may already be spent.
 */
export async function settleCall(
  reservationId: string,
  record: UsageRecord,
): Promise<void> {
  try {
    await createAdminClient()
      .from("ai_usage_logs")
      .update({
        model: record.model,
        input_tokens: record.inputTokens ?? null,
        output_tokens: record.outputTokens ?? null,
        cost_cents: record.costCents ? Math.round(record.costCents) : null,
        latency_ms: record.latencyMs ?? null,
        status: record.status,
      })
      .eq("id", reservationId);
  } catch {
    // Losing the outcome must not fail the user's request. The row is still
    // there and still counted; what is lost is what it cost, which the admin
    // panel reports as a reservation nobody closed.
  }
}
