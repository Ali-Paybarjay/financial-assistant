import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sweepStaleGuests } from "@/lib/guests";
import { readSettings } from "@/lib/settings-server";

/**
 * Deletes guests nobody is coming back for.
 *
 * The login screen tells a guest their data is temporary. A guest who signs out
 * keeps that promise themselves; a guest who closes the tab never does, and
 * without this their spending would sit in the database indefinitely. So the
 * promise is kept on their behalf, once a night.
 *
 * It runs here rather than in Postgres because deleting an upload needs the
 * Storage API — see migration 0018 for the version that looked simpler and
 * could not work.
 *
 * The sweep itself is in lib/guests.ts, shared with the admin panel's «purge
 * now», and it records the run in `cron_runs` so that «did it happen» is a
 * question with an answer on a page rather than in a scheduler's log.
 */

/** Same length or not, the comparison must not leak where it stopped matching. */
function matches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Refuse rather than run unprotected. An endpoint that deletes accounts must
  // never be open because a variable was forgotten.
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  }

  const header = request.headers.get("authorization") ?? "";
  if (!matches(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The service role, because the scheduler is not a browser and carries no
  // session — so there is no user whose RLS could read the settings row.
  const settings = await readSettings(createAdminClient());

  const result = await sweepStaleGuests({
    days: settings.guest_retention_days,
    triggeredBy: "cron",
  });

  return NextResponse.json(result);
}
