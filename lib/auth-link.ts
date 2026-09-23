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
  | "switch"
  /** The same trip, after Google said it could not be made without a screen. */
  | "switch-retry";

const INTENTS: LinkIntent[] = ["link", "switch", "switch-retry"];

export function readLinkIntent(value: string | undefined): LinkIntent | null {
  return INTENTS.find((intent) => intent === value) ?? null;
}

/** Both legs of «sign me into the account I already have» are one trip. */
export function isSwitch(intent: LinkIntent | null): boolean {
  return intent === "switch" || intent === "switch-retry";
}

/**
 * Google saying «not without showing the user something».
 *
 * `prompt=none` asks for a sign-in with no screen at all, which is the right
 * request the second time round: the account was chosen at Google seconds
 * earlier, and opening the chooser again asks a question that has just been
 * answered. When Google cannot honour it — no session, or several accounts it
 * will not choose between — it refuses with one of these instead of failing,
 * and the trip is simply made again the ordinary way.
 *
 * Measured against the live endpoint rather than taken from the spec: Google
 * answers `interaction_required`, and GoTrue passes it through to us unchanged
 * as `?error=`. The rest are the neighbouring refusals from the same family,
 * matched because here they mean the same thing.
 */
export function needsGoogleScreen(error: string | null): boolean {
  return (
    error === "interaction_required" ||
    error === "login_required" ||
    error === "consent_required" ||
    error === "account_selection_required"
  );
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

/**
 * Whether the account we have just been signed in to was made by that very
 * sign-in.
 *
 * It matters on the way back from «sign me into the account I already have».
 * If Google shows its chooser and a *different* address is picked — one with
 * no account here — the sign-in still succeeds, because Supabase creates a
 * user for whoever turns up. The result is an empty account nobody asked for,
 * standing where the user's own account was supposed to be, and the guest they
 * agreed to leave would be deleted for it.
 *
 * The two timestamps come from the same row and are compared to each other,
 * never to our clock: an account signing in for the first time has them within
 * a moment of each other, and one that existed before has a `created_at` from
 * whenever it was made. Clock skew between here and Postgres cannot make an
 * old account look new, which is the mistake that would matter — it is the one
 * that ends in deleting something real.
 *
 * `last_sign_in_at` is set on every sign-in, but two of the rows in this
 * project have none, so there is a fallback: a `created_at` from moments ago
 * by our own clock. That one can be fooled by skew, which is why it is only
 * ever half the answer — the delete downstream has its own guard, and being
 * wrong here costs a retry rather than an account.
 */
export function isBrandNewAccount(
  createdAt: string | undefined,
  lastSignInAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return false;

  if (lastSignInAt) {
    const signedIn = Date.parse(lastSignInAt);
    if (!Number.isNaN(signedIn)) return Math.abs(signedIn - created) < 60_000;
  }
  return Math.abs(now - created) < 60_000;
}
