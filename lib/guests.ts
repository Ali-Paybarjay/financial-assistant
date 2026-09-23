import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** How long an untouched guest is kept before the nightly sweep removes them. */
export const GUEST_RETENTION_DAYS = 7;

/**
 * Deletes a guest and everything they entered.
 *
 * Storage first, and through the Storage API rather than SQL. Uploads have no
 * foreign key back to auth.users, so deleting the user alone orphans every
 * receipt they scanned — and a `delete from storage.objects` is refused by
 * Supabase's protect_delete trigger for a good reason: removing the row does
 * not remove the file behind it, so the bytes would outlive the account
 * either way. Everything else is ON DELETE CASCADE, so the user delete
 * finishes the job.
 */
export async function purgeGuest(userId: string): Promise<void> {
  const admin = createAdminClient();

  for (const bucket of ["receipts", "voice-notes"] as const) {
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
