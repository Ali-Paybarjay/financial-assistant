import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** How long an untouched guest is kept before the nightly sweep removes them. */
export const GUEST_RETENTION_DAYS = 7;

/**
 * Every private bucket a user can put bytes in.
 *
 * It used to be `receipts` and `voice-notes`, which was wrong in both
 * directions: `voice-notes` was deleted through the Storage API back in
 * migration 0003, and `statements` — added by 0007, and the bucket that holds
 * the *largest* files in the product, up to 15MB each — was never swept at all.
 * So deleting a user left their uploaded bank statements in storage forever,
 * and the list looked complete because it had two entries in it.
 */
const USER_BUCKETS = ["receipts", "statements"] as const;

/**
 * Deletes a user and everything they entered.
 *
 * Storage first, and through the Storage API rather than SQL. Uploads have no
 * foreign key back to auth.users, so deleting the user alone orphans every
 * receipt they scanned — and a `delete from storage.objects` is refused by
 * Supabase's protect_delete trigger for a good reason: removing the row does
 * not remove the file behind it, so the bytes would outlive the account
 * either way. Everything else is ON DELETE CASCADE, so the user delete
 * finishes the job.
 *
 * Named for a user rather than a guest because the admin panel deletes real
 * accounts through it too. Nothing about the work was ever guest-specific; the
 * name was, and it was the reason `deleteAccount()` in settings had grown its
 * own half-version that skipped the storage sweep.
 */
export async function purgeUser(userId: string): Promise<void> {
  const admin = createAdminClient();

  for (const bucket of USER_BUCKETS) {
    const { data: files } = await admin.storage.from(bucket).list(userId);
    if (files?.length) {
      await admin.storage.from(bucket).remove(files.map((file) => `${userId}/${file.name}`));
    }
  }

  await admin.auth.admin.deleteUser(userId);
}

/**
 * The guests nobody is coming back for. Reported by Postgres, deleted from
 * here: the query needs the auth schema, and the deletion needs the Storage
 * API, so neither half can do both.
 */
export async function staleGuestIds(days = GUEST_RETENTION_DAYS): Promise<string[]> {
  const { data, error } = await createAdminClient().rpc("stale_guest_ids", {
    max_age: `${days} days`,
  });

  if (error) throw new Error(`could not list stale guests: ${error.message}`);
  return data ?? [];
}

/**
 * Whether an account has anything in it.
 *
 * Asked before discarding one, and asked with the service role because the
 * account being examined is not the one whose session is in hand. It is the
 * last of the guards in front of a delete: an account with a single row in it
 * is somebody's, whatever its timestamps say.
 */
export async function accountIsEmpty(userId: string): Promise<boolean> {
  const admin = createAdminClient();

  const counts = await Promise.all(
    (["transactions", "accounts", "goals", "dong_groups"] as const).map((table) =>
      admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId),
    ),
  );

  // A count that failed to come back is not a zero. Refusing to answer «empty»
  // is the safe direction: it costs a stray row, not somebody's ledger.
  return counts.every((result) => result.error === null && (result.count ?? 1) === 0);
}

export type SweepResult = { found: number; purged: number; failed: number };

/**
 * One nightly sweep, and one «purge now» button, sharing a body.
 *
 * The loop lived in the cron route, which meant the panel's button would have
 * been a second implementation of the same deletion — and the one that is only
 * run by hand is the one that drifts. Whoever called it is recorded rather than
 * inferred, because «7 guests went at 14:02» is a different event from «7
 * guests went at 03:17» and the log has to be able to say which.
 *
 * The run is written before the work starts, so a sweep that dies half-way
 * leaves a row with no `finished_at` — which is the only way «it crashed» and
 * «it never ran» can be told apart. Migration 0018 is why that matters here:
 * the first version of this sweep failed silently every night and nothing
 * anywhere would have said so.
 */
export async function sweepStaleGuests({
  days = GUEST_RETENTION_DAYS,
  triggeredBy,
}: {
  days?: number;
  triggeredBy: "cron" | "admin";
}): Promise<SweepResult> {
  const admin = createAdminClient();

  const { data: run } = await admin
    .from("cron_runs")
    .insert({ job: "purge-guests", triggered_by: triggeredBy })
    .select("id")
    .single();

  const finish = async (result: SweepResult | null, error?: string) => {
    if (!run) return;
    await admin
      .from("cron_runs")
      .update({ finished_at: new Date().toISOString(), result, error: error ?? null })
      .eq("id", run.id);
  };

  let ids: string[];
  try {
    ids = await staleGuestIds(days);
  } catch (cause) {
    await finish(null, cause instanceof Error ? cause.message : "could not list guests");
    throw cause;
  }

  // One at a time, and one failure does not abandon the rest: a guest whose
  // storage call times out should not keep every guest behind them alive for
  // another day.
  let purged = 0;
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await purgeUser(id);
      purged += 1;
    } catch {
      failed.push(id);
    }
  }

  const result: SweepResult = { found: ids.length, purged, failed: failed.length };
  await finish(result);
  return result;
}
