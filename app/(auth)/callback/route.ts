import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { accountIsEmpty, purgeUser } from "@/lib/guests";
import {
  LINK_INTENT_COOKIE,
  LINK_INTENT_MAX_AGE,
  type LinkIntent,
  isBrandNewAccount,
  isIdentityTaken,
  isSwitch,
  needsGoogleScreen,
  readLinkIntent,
} from "@/lib/auth-link";

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

  /** Back out to Google for another leg, carrying the intent with us. */
  function leave(url: string, next: LinkIntent) {
    const response = NextResponse.redirect(url);
    response.cookies.set(LINK_INTENT_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: LINK_INTENT_MAX_AGE,
    });
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

    // The silent attempt could not be made silently. Not an error, and not
    // something to tell the user about — just go again the ordinary way, and
    // let Google ask whatever it needs to ask.
    //
    // Only from "switch", never from "switch-retry": the second leg has
    // already dropped `prompt=none`, so if it comes back here saying a screen
    // is needed, going again would say it again, forever.
    if (intent === "switch" && needsGoogleScreen(failure)) {
      const supabase = await createClient();
      const { data } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/callback` },
      });
      if (data?.url) return leave(data.url, "switch-retry");
      return land("/account-exists?error=google_failed");
    }

    if (failure === "access_denied") {
      // They pressed cancel at Google. Nothing is wrong, so nothing should be
      // reported as wrong — and nothing has been taken down either, which is
      // the whole reason the guest is still standing at this point.
      if (isSwitch(intent)) return land("/account-exists");
      return land(intent ? "/save-account" : "/login?error=cancelled");
    }
    if (isSwitch(intent)) return land("/account-exists?error=google_failed");
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
  //
  // Nothing else happens to the guest here — no sign-out, deliberately. The
  // exchange is PKCE, and its verifier lives in the same cookie store as the
  // session: `signOut()` calls `removeAllPKCEVerifiers()`, so signing the
  // guest out first leaves the very next line with a code and no verifier and
  // the sign-in dies one step from the finish. (Measured: GoTrue logged the
  // provider callback succeeding, then a /logout, then no /token at all.)
  // There is no need for it either — a successful exchange overwrites the
  // session it finds.
  let leaving: string | null = null;
  let guestSession: { access_token: string; refresh_token: string } | null = null;
  if (isSwitch(intent)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.is_anonymous) {
      leaving = user.id;
      // Kept so the guest can be put back if this trip lands somewhere it was
      // not meant to. The exchange overwrites the cookie but does not touch
      // the tokens themselves, so they are still good afterwards.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        guestSession = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        };
      }
    }
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // A guest is still a guest when this fails, session and rows intact, so
    // put them back on the screen they were deciding on rather than at a login
    // page they are already past.
    if (isSwitch(intent)) return land("/account-exists?error=google_failed");
    if (intent === "link") return land("/save-account?error=google_failed");
    return land("/login?error=expired_link");
  }

  // The account chooser can be answered wrongly.
  //
  // Google opens it whenever it will not decide between several signed-in
  // accounts, and picking an address with no account here does not fail — it
  // creates one. So the user presses «sign me into the account I already have»
  // and arrives, a moment later, at the first step of onboarding in an empty
  // account, with the guest they agreed to leave already deleted for it.
  //
  // None of that is what they asked for, and none of it is kept: the guest
  // goes back on, the account nobody wanted goes away, and they land back on
  // the same decision to try again. Pressing the wrong thing at Google now
  // costs a second, which is what it should have cost all along.
  if (leaving && data.user && isBrandNewAccount(data.user.created_at, data.user.last_sign_in_at)) {
    const stray = data.user.id;

    if (guestSession) {
      await supabase.auth.setSession(guestSession);
    }

    // Three guards, because this is a delete and the account is not the one
    // whose session we hold: it has to be new by its own timestamps, it has to
    // be somebody other than the guest, and it has to be empty. Any doubt and
    // the row stays — a stray account is a mess, a deleted one is a loss.
    if (stray !== leaving && (await accountIsEmpty(stray))) {
      try {
        await purgeUser(stray);
      } catch {
        // Leaving it behind is untidy, not harmful.
      }
    }

    return land(guestSession ? "/account-exists?error=wrong_account" : "/login?error=wrong_account");
  }

  // The id has to differ, and it is checked rather than assumed: `leaving` is
  // about to be deleted outright, and deleting it while it is also the account
  // just signed in to would destroy the thing this whole trip was for.
  if (leaving && data.user && data.user.id !== leaving) {
    // Now, and only now: the account they came back for is really in hand, so
    // the guest they agreed to give up can go. Same as every other sign-out in
    // this app, which takes a guest's data with it.
    try {
      await purgeUser(leaving);
    } catch {
      // Not worth failing the sign-in over. purge_stale_guests() sweeps.
    }
  }

  if (isSwitch(intent)) {
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
