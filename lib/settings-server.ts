import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { DEFAULT_SETTINGS, parseSettings, type AppSettings } from "./settings";

/**
 * Reads the table with whichever client the caller has.
 *
 * A parameter rather than a fixed client because the cron route has no user
 * session and must use the service role, while everything else runs inside a
 * request and should go through RLS. One function, so the parse and the
 * fallback cannot drift between the two.
 */
export async function readSettings(
  client: SupabaseClient<Database>,
): Promise<AppSettings> {
  const { data, error } = await client.from("app_settings").select("key, value");
  if (error) return { ...DEFAULT_SETTINGS };
  return parseSettings(data);
}

/**
 * The per-request copy. Five rows on a primary key, and React's cache collapses
 * the layout's read and the composer's read into one.
 *
 * Worth checking before adding a caller: the paths that read this already
 * query the database (remainingCalls counts today's usage, the app layout
 * selects the profile), so this adds a round trip to a request rather than to
 * a page that had none.
 */
export const appSettings = cache(async function appSettings(): Promise<AppSettings> {
  return readSettings(await createClient());
});
