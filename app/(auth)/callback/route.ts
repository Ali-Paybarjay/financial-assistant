import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { purgeGuest } from "@/lib/guests";
import { LINK_INTENT_COOKIE, isIdentityTaken, readLinkIntent } from "@/lib/auth-link";

/**
 * Where every round trip comes back to: email confirmation links, password
 * resets, signing in with Google, and the two things a guest can do with
 * Google — attach it to the account they already have rows in, or give that
 * account up for an older one.
 *
 * All three Google journeys arrive here identically — same provider, same
 * redirect, same query string — and want opposite things. The clearest case is
 * «this Google account already exists»: for an ordinary sign-in that is a hard
 * error, while for a guest who was linking it is not an error at all — it
 * means «you already have an account here», which has to be said rather than
 * swallowed into the login page's generic «this link expired».
 *
 * The cookie set on the way out is what tells them apart. It is cleared the
 * moment we are back, whichever way it went, so a stale one cannot misroute
 * the next sign-in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const jar = await cookies();
  const intent = readLinkIntent(jar.get(LINK_INTENT_COOKIE)?.value);

  function land(path: string) {
    const response = NextResponse.redirect(`${origin}${path}`);
    if (intent) response.cookies.delete(LINK_INTENT_COOKIE);
    return response;
  }

  // The provider's own refusals, which come back as query parameters rather
  // than as a code. Read before `code`, or every one of them reads as a link
  // that expired.
  const failure = searchParams.get("error");
  if (failure) {
    const description = searchParams.get("error_description") ?? "";

    if (intent === "link" && isIdentityTaken(searchParams.get("error_code"), description)) {
      // Not a failure from where the user is standing: the account they were
      // trying to create is one they already have.
      return land("/account-exists");
    }
    if (failure === "access_denied") {
      // They pressed cancel at Google. Nothing is wrong, so nothing should be
      // reported as wrong — and nothing has been taken down either, which is
      // the whole reason the guest is still standing at this point.
      return land(intent ? "/save-account" : "/login?error=cancelled");
    }
    return land(intent ? "/save-account?error=google_failed" : "/login?error=google_failed");
  }

  const code = searchParams.get("code");
  if (!code) {
    return land("/login?error=missing_code");
  }

  const supabase = await createClient();

  // Read before the exchange replaces the session, and read from the session
  // rather than from anything the browser sent: this id is about to be handed
  // to a delete that runs with admin rights.
  let leaving: string | null = null;
  if (intent === "switch") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.is_anonymous) leaving = user.id;
    // Clear the guest's cookies first, so the exchange happens the ordinary
    // way with no session in place. Local only — the guest's rows are still
    // there, and stay there unless the new session actually arrives.
    await supabase.auth.signOut({ scope: "local" });
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return land("/login?error=expired_link");
  }

  if (leaving) {
    // Now, and only now: the account they came back for is really in hand, so
    // the guest they agreed to give up can go. Same as every other sign-out in
    // this app, which takes a guest's data with it.
    try {
      await purgeGuest(leaving);
    } catch {
      // Not worth failing the sign-in over. purge_stale_guests() sweeps.
    }
    return land("/");
  }

  // A guest who has just linked Google has kept everything and gained a way
  // back in, which is the whole reason they were on that page. Landing them
  // silently on the dashboard leaves them wondering whether it worked.
  if (intent === "link") {
    return land("/save-account?linked=google");
  }

  // Only same-origin relative paths, so a crafted link cannot bounce the user
  // off-site with a fresh session in hand.
  const next = searchParams.get("next") ?? "/";
  const destination = next.startsWith("/") ? next : "/";
  return land(destination);
}
