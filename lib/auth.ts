import "server-only";

import { cache } from "react";
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
   * True while the person is signed in anonymously. Their rows are ordinary
   * rows under an ordinary user id — what is missing is any way back in, which
   * is why the app keeps saying so until they add an email.
   */
  isGuest: boolean;
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
 * getUser round-trips to the auth server to revalidate the token, so the two
 * layouts and the action underneath them must not each ask separately. React's
 * cache collapses them into one call per request.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The single way a server component or action gets the current user. Throws the
 * user back to /login rather than returning null, so callers never have to
 * handle a signed-out branch they cannot recover from anyway.
 */
export async function requireViewer(): Promise<Viewer> {
  const user = await getSessionUser();

  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return {
    userId: user.id,
    // An anonymous user comes back with "" rather than null, and an empty
    // string is not an address — anything downstream asking "has an email?"
    // would get the wrong answer from it.
    email: user.email || null,
    profile,
    currency: isCurrencyCode(profile.base_currency) ? profile.base_currency : "CAD",
    timeZone: profile.timezone || "UTC",
    isGuest: user.is_anonymous === true,
    identity: { fullName: providerFullName(user) },
  };
}
