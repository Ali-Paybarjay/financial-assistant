import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { isCurrencyCode, type CurrencyCode } from "@/lib/money";

export type Viewer = {
  userId: string;
  email: string | null;
  profile: ProfileRow;
  currency: CurrencyCode;
  timeZone: string;
};

/**
 * The single way a server component or action gets the current user. Throws the
 * user back to /login rather than returning null, so callers never have to
 * handle a signed-out branch they cannot recover from anyway.
 */
export async function requireViewer(): Promise<Viewer> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    currency: isCurrencyCode(profile.base_currency) ? profile.base_currency : "CAD",
    timeZone: profile.timezone || "UTC",
  };
}
