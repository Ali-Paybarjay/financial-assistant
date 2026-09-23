/**
 * The breadcrumb a guest leaves on their way to Google.
 *
 * The OAuth round trip comes back to one callback, and by then nothing in the
 * request says which of three journeys it was: an ordinary sign-in, a guest
 * linking Google to the account they already have rows in, or a guest giving
 * that account up to get back into an older one. The three need different
 * handling — the same «identity already exists» refusal is a hard error for
 * the first and a decision to put to the user for the second — so the intent
 * is written down before we leave and read when we come back.
 *
 * Not `?next=` on the redirect: Supabase matches redirect_to against its
 * allow-list as a whole string, so a query parameter can turn a listed URL
 * into an unlisted one and bounce the user to the Site URL instead. A cookie
 * is not part of that comparison.
 *
 * It carries an intent and nothing else — no user id, no email. The callback
 * acts on it with admin rights, and anything a browser can write is something
 * an attacker can write: an id in here would be an invitation to name somebody
 * else's account for deletion. Whose guest session is being left is read from
 * the session itself, server-side, where the browser has no say.
 */
export const LINK_INTENT_COOKIE = "link_intent";

/** Long enough to sign in with Google, short enough not to outlive the trip. */
export const LINK_INTENT_MAX_AGE = 600;

export type LinkIntent =
  /** Attach Google to this guest, keeping every row they have entered. */
  | "link"
  /** Leave this guest behind and sign in to the account Google already has. */
  | "switch";

export function readLinkIntent(value: string | undefined): LinkIntent | null {
  return value === "link" || value === "switch" ? value : null;
}

/**
 * Whether GoTrue is telling us this Google account is already somebody's.
 *
 * Manual linking refuses rather than merging, which is the safe refusal: two
 * ledgers are not automatically one person's. The code is the reliable half;
 * the prose is matched too because the error surfaces through an OAuth
 * redirect, where providers have been known to pass along only a description.
 */
export function isIdentityTaken(code: string | null, description: string): boolean {
  if (code === "identity_already_exists") return true;
  return /identity is already linked|already linked to another|identity_already_exists/i.test(
    description,
  );
}
