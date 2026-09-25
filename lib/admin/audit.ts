import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

/**
 * The record of what an operator did.
 *
 * Written through the table's insert policy rather than an RPC: the policy
 * already pins `actor_id` to `auth.uid()`, so a forged actor is impossible and
 * a function wrapping it would add nothing but a second place to keep in step.
 *
 * `actor_email` is denormalised on purpose — see the row type. A log that
 * outlives the account it names is worth more than a log that joins cleanly.
 */

export type AuditEntry = {
  /** Dotted and coarse: user.delete, guests.purge, category.save, settings.save. */
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
};

/**
 * Called *after* the thing it records, and deliberately cannot fail the caller.
 *
 * The alternative is worse in both directions. Logging first means logging
 * actions that then did not happen. Throwing on a failed log after a successful
 * delete means telling the operator their delete failed when the account is
 * already gone — so they try again, and the second attempt reports «no such
 * user» and looks like a different bug.
 *
 * Same trade logUsage() makes for the same reason, and the failure is loud in
 * the server log even though it is quiet in the UI.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const user = await getSessionUser();
    if (!user) return;

    const supabase = await createClient();
    const { error } = await supabase.from("admin_audit_log").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      detail: entry.detail ?? null,
    });

    if (error) console.error(`audit(${entry.action}) failed: ${error.message}`);
  } catch (cause) {
    console.error(`audit(${entry.action}) threw`, cause);
  }
}

/**
 * The shape a settings or category change is recorded in.
 *
 * Before and after, per field, and only the fields that moved: a diff of five
 * unchanged numbers is a row nobody can read the meaning out of.
 */
export function changed<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};

  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    // JSON compare so nested values (the three daily ceilings) are compared by
    // content rather than by reference.
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      diff[key] = { from: from ?? null, to: to ?? null };
    }
  }

  return diff;
}
