import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_RETENTION_DAYS, purgeGuest, staleGuestIds } from "@/lib/guests";

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

  const ids = await staleGuestIds(GUEST_RETENTION_DAYS);

  // One at a time, and one failure does not abandon the rest: a guest whose
  // storage call times out should not keep every guest behind them alive for
  // another day.
  let purged = 0;
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await purgeGuest(id);
      purged += 1;
    } catch {
      failed.push(id);
    }
  }

  return NextResponse.json({ found: ids.length, purged, failed: failed.length });
}
