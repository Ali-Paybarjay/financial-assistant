import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Service-role client. It bypasses RLS entirely, so every use of it is listed
 * here and every new one needs a reason — it is risk R6 in PLAN.md, and the
 * whole of it:
 *
 *   * lib/ai/usage.ts — writing ai_usage_logs, which deliberately has no insert
 *     policy so a client cannot forge its own rate limit away
 *   * app/api/parse/receipt + app/api/import/statement — reading the user's own
 *     upload out of a private bucket, after their own client has already
 *     confirmed through RLS that the row is theirs
 *   * lib/guests.ts — deleting a user and their files, and reading whether an
 *     account that is not the session holder's is empty
 *
 * The admin panel is deliberately *not* on this list: its reports are
 * `security definer` RPCs that check the claim themselves, so it reads through
 * the ordinary client. See migration 0027.
 *
 * Never import this from a Client Component — the "server-only" import above
 * turns that into a build error.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
