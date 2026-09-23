"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { purgeGuest } from "@/lib/guests";
import {
  LINK_INTENT_COOKIE,
  LINK_INTENT_MAX_AGE,
  type LinkIntent,
} from "@/lib/auth-link";
import {
  forgotPasswordSchema,
  loginSchema,
  PASSWORD_MIN_LENGTH_FA,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth";

export type ActionResult = { error: string } | { ok: true };

/**
 * Supabase returns English messages keyed off an internal code. The user never
 * sees those; every branch here says what happened and what to do about it.
 */
function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "ایمیل یا رمز درست نیست. دوباره بزن یا رمزت را بازیابی کن.";
  }
  if (normalized.includes("email not confirmed")) {
    return "هنوز ایمیلت را تأیید نکرده‌ای. لینک تأیید را در ایمیلت بزن.";
  }
  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "با این ایمیل قبلاً حساب ساخته شده. وارد شو یا رمزت را بازیابی کن.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "دفعات زیادی تلاش شد. چند دقیقه صبر کن و دوباره بزن.";
  }
  // Supabase reports a password found in a breach corpus through the same
  // "weak password" code as one that is merely short, so the two are told
  // apart by the reason it gives. The advice has to differ: a leaked password
  // can be long and complex, and telling someone to "add a digit" when the
  // real problem is that it is already on a list reads as the app being broken.
  if (normalized.includes("pwned") || normalized.includes("leaked") || normalized.includes("compromised")) {
    return "این رمز در نشتِ اطلاعاتِ سایت‌های دیگر دیده شده. رمزی بگذار که جای دیگری استفاده نکرده‌ای.";
  }
  // GoTrue's own length rejection, which arrives as plain prose rather than
  // through the weak-password code. The app's zod floor normally catches this
  // first, so this branch only fires if the two drift apart — which is exactly
  // when the user most needs a real sentence instead of the generic fallback.
  if (normalized.includes("should be at least")) {
    return `رمز باید دست‌کم ${PASSWORD_MIN_LENGTH_FA} نویسه باشد.`;
  }
  if (normalized.includes("weak password")) {
    return `رمز ساده است. دست‌کم ${PASSWORD_MIN_LENGTH_FA} نویسه، ترکیبی از حرف و عدد بگذار.`;
  }
  if (normalized.includes("anonymous")) {
    // Guest sign-in is a project-level switch in Supabase. If it is off, the
    // button is there and does nothing, so say which door is still open.
    return "ورود مهمان فعلاً در دسترس نیست. با ایمیل وارد شو یا حساب بساز.";
  }
  return "کار پیش نرفت. دوباره بزن؛ اگر باز هم نشد، چند دقیقه بعد امتحان کن.";
}

/**
 * Where the links in **emails** point. Falls back to the domain Vercel
 * injects, so a deployment cannot silently mail out localhost links because
 * someone forgot to set a variable.
 *
 * Emails only. A confirmation link is opened whenever the person gets round
 * to it — a different day, often a different device — so it has to name a
 * durable address rather than whichever deployment happened to send it. The
 * OAuth round trip is the opposite case and uses `requestOrigin()`.
 */
function appUrl(path: string): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  const fromVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = explicit || (fromVercel && `https://${fromVercel}`) || "http://localhost:3000";
  return new URL(path, base).toString();
}

export async function login(raw: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { error: "ایمیل و رمز را کامل وارد کن." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: translateAuthError(error.message) };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(raw: unknown): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { error: "فرم را کامل پر کن." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      // No query string: Supabase matches redirect_to against the allow list
      // literally, so `?next=…` turns a listed URL into an unlisted one and
      // the user is silently bounced to the Site URL instead. The callback
      // defaults to /dashboard, and the app layout sends anyone with unfinished
      // onboarding to the right step anyway.
      emailRedirectTo: appUrl("/callback"),
    },
  });

  if (error) return { error: translateAuthError(error.message) };
  return { ok: true };
}

export async function requestPasswordReset(raw: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { error: "ایمیلت را بنویس." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: appUrl("/callback?next=/reset-password"),
  });

  // A wrong address must look identical to a right one, or this endpoint
  // becomes a way to test which emails have accounts.
  if (error && !error.message.toLowerCase().includes("not found")) {
    return { error: translateAuthError(error.message) };
  }
  return { ok: true };
}

export async function resetPassword(raw: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: `رمز باید دست‌کم ${PASSWORD_MIN_LENGTH_FA} نویسه باشد.` };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) return { error: translateAuthError(error.message) };

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * The origin this request actually arrived on.
 *
 * Only for the OAuth round trip, which comes back inside the same browsing
 * session and therefore has to come back to the same site. `appUrl()` is
 * absolute and always names production, which is right for an email opened
 * three days from now and wrong here: it means signing in with Google on a
 * preview deployment silently lands you on production, looking at different
 * code and wondering why nothing changed.
 *
 * Trusting a request header to build a redirect is normally how open
 * redirects happen. It is safe here, and only here, because the header is not
 * what decides where the user ends up — Supabase will only send them to a URL
 * on its own redirect allow-list, and refuses to anything else by falling
 * back to the configured Site URL. The header can pick among permitted
 * destinations; it cannot add one. If that allow-list is ever emptied or set
 * to a wildcard, this stops being safe.
 */
async function requestOrigin(): Promise<string | null> {
  const headerList = await headers();
  // Vercel sets the x-forwarded pair; `host` covers running it anywhere else.
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return null;
  const protocol =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/**
 * Written immediately before the browser is handed to Google, read in
 * /callback. See lib/auth-link.ts for why this is a cookie and not a query
 * parameter, and why it never carries an id.
 */
async function markLinkIntent(intent: LinkIntent): Promise<void> {
  (await cookies()).set(LINK_INTENT_COOKIE, intent, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LINK_INTENT_MAX_AGE,
  });
}

export async function signInWithGoogle(): Promise<ActionResult> {
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: origin
        ? new URL("/callback", origin).toString()
        : appUrl("/callback"),
    },
  });

  if (error) return { error: translateAuthError(error.message) };
  if (data.url) redirect(data.url);
  return { error: "ورود با گوگل در دسترس نیست. با ایمیل و رمز وارد شو." };
}

/**
 * Guest entry. No email, no password, no confirmation link — Supabase mints an
 * anonymous user, which is a real row in auth.users with is_anonymous = true,
 * so every RLS policy in the schema (all of them `to authenticated`) applies
 * unchanged and the guest's data is isolated exactly like anyone else's.
 *
 * Onboarding still runs: the dashboard cannot say anything useful until it
 * knows a currency, and a guest who skips it lands on empty charts and
 * concludes the app is broken rather than that they skipped a step.
 */
export async function continueAsGuest(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously();

  if (error) return { error: translateAuthError(error.message) };

  revalidatePath("/", "layout");
  redirect("/onboarding/1");
}

/**
 * Turns the guest into a real account without touching their data. This is an
 * update to the existing user, not a new signup: the user id does not change,
 * so every transaction, account, goal and dong row they created while trying
 * the app stays exactly where it is and simply gains a way to sign back in.
 *
 * Email and password go in one call, and that is not a tidiness choice: GoTrue
 * refuses "Updating password of an anonymous user without an email or phone",
 * and a pending email change does not satisfy it either. Setting them
 * separately fails in both orders — measured, not assumed. Supplying the
 * address in the same request is the only shape that is accepted.
 *
 * Afterwards the user is still anonymous, with the address parked in new_email
 * until they click the link. The password is already live, so the account is
 * recoverable the moment they confirm.
 */
export async function upgradeGuestAccount(raw: unknown): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { error: "فرم را کامل پر کن." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.is_anonymous) {
    return { error: "حسابت از قبل ساخته شده. از تنظیمات اطلاعاتت را ویرایش کن." };
  }

  const { error } = await supabase.auth.updateUser(
    {
      email: parsed.data.email,
      password: parsed.data.password,
      data: { full_name: parsed.data.fullName },
    },
    // Same reason as signup: no query string, or Supabase compares the whole
    // URL against the allow list and silently sends them to the Site URL.
    { emailRedirectTo: appUrl("/callback") },
  );
  if (error) return { error: translateAuthError(error.message) };

  // The profile row is what the app reads names from; user_metadata is only
  // ever a fallback for what a provider told us.
  await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Keeping a guest's data and attaching Google to it.
 *
 * `linkIdentity`, emphatically not `signInWithOAuth`. Signing in with Google
 * mints a *new* user; the anonymous one — and every transaction, account,
 * goal and trip on it — is simply left behind. Linking attaches the provider
 * to the user who is already signed in, so the id never changes and the rows
 * stay theirs. That is the entire promise this page makes.
 *
 * It needs «Manual linking» enabled on the Supabase project. Without it
 * GoTrue refuses, and the message below says so in a way the user can act on
 * rather than leaving them on a page whose button does nothing.
 */
export async function linkGuestToGoogle(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.is_anonymous) {
    return { error: "حسابت از قبل ساخته شده. از تنظیمات اطلاعاتت را ویرایش کن." };
  }

  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: origin
        ? new URL("/callback", origin).toString()
        : appUrl("/callback"),
    },
  });

  if (error) {
    // Distinguished on purpose: «not switched on» is a thing the owner of
    // the project fixes, and reading «try again» instead would send the user
    // in circles.
    if (/manual linking|not enabled|disabled/i.test(error.message)) {
      return {
        error: "ورود با گوگل برای حساب مهمان هنوز فعال نیست. با ایمیل و رمز حساب بساز.",
      };
    }
    return { error: translateAuthError(error.message) };
  }

  if (data.url) {
    // Without this, a Google account that already has an account here comes
    // back as an anonymous failure and the user is sent to the login page to
    // guess what went wrong.
    await markLinkIntent("link");
    redirect(data.url);
  }
  return { error: "ورود با گوگل در دسترس نیست. با ایمیل و رمز حساب بساز." };
}

/**
 * The other side of the fork: this Google account is already somebody's here,
 * and that somebody is them.
 *
 * Linking is off the table — GoTrue refuses to attach an identity that another
 * user owns, and it is right to: merging two ledgers is a decision with no
 * safe default, since the same salary could end up in the sum twice. So this
 * signs in with Google properly, landing the user in the account they already
 * had.
 *
 * What it deliberately does **not** do is tear down the guest first. The
 * obvious order — purge, sign out, then go to Google — destroys the data
 * before the thing it was traded for has happened, so pressing cancel on
 * Google's own screen would cost the user everything and gain them nothing.
 * The guest session is left exactly as it is; /callback takes it down only
 * once the new session is really in hand. Cancelling here costs nothing.
 */
export async function signInToExistingGoogleAccount(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.is_anonymous) {
    return { error: "حسابت از قبل ساخته شده. از تنظیمات اطلاعاتت را ویرایش کن." };
  }

  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: origin
        ? new URL("/callback", origin).toString()
        : appUrl("/callback"),
      // They picked this account at Google seconds ago — that is how we know
      // it is taken — so the second trip should show them nothing at all.
      // `prompt: "none"` asks for exactly that: a sign-in with no screen.
      //
      // Leaving the parameter off is not the same thing. Google then decides,
      // and its decision is to open the chooser whenever more than one account
      // is signed in — which is what the user is complaining about, and it is
      // not a question they can answer any better the second time.
      //
      // When Google genuinely cannot do it silently it refuses with
      // `interaction_required` rather than failing, and /callback makes the
      // trip again the ordinary way. So this can only remove a screen, never
      // cost one.
      queryParams: { prompt: "none" },
    },
  });

  if (error) return { error: translateAuthError(error.message) };

  if (data.url) {
    await markLinkIntent("switch");
    redirect(data.url);
  }
  return { error: "ورود با گوگل در دسترس نیست. با ایمیل و رمز وارد شو." };
}

export async function logout(): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Every sign-out path in the app funnels through here — settings, the
  // onboarding exit button, the guest banner — so the promise made to guests
  // is kept by all of them without each one having to remember it.
  //
  // A failed purge must not block the sign-out. Leaving someone signed in to an
  // account they just asked to destroy is the worse of the two failures, and
  // the row is not stranded either way: purge_stale_guests() sweeps up whatever
  // this missed.
  if (user?.is_anonymous) {
    try {
      await purgeGuest(user.id);
    } catch {
      // Deliberately silent. Nothing the user could do with this.
    }
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
