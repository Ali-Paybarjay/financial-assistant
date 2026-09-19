import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { isCurrencyCode, type CurrencyCode } from "@/lib/money";

export type Viewer = {
  userId: string;
  email: string | null;
  profile: ProfileRow;
  currency: CurrencyCode;
  timeZone: string;
  /**
   * What the sign-in provider said about the person. Only ever used to prefill
   * a field the user has not answered yet — the profile row stays the truth.
   */
  identity: { fullName: string | null };
};

/**
 * Providers disagree on where the name lives: Google sends `full_name` and
 * `name`, some OIDC servers send only the two halves. An email/password signup
 * puts what the user typed in `full_name`. Anything blank is skipped, and the
 * email is never mangled into a name — an address's local part is not what
 * anyone is called.
 */
function providerFullName(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const candidates = [
    text(meta.full_name),
    text(meta.name),
    [text(meta.given_name), text(meta.family_name)].filter(Boolean).join(" "),
  ];

  return candidates.find((candidate) => candidate.length > 0) ?? null;
}

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
    identity: { fullName: providerFullName(user) },
  };
}
