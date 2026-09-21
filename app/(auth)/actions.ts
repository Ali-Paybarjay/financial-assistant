"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { purgeGuest } from "@/lib/guests";
import {
  forgotPasswordSchema,
  loginSchema,
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
  if (normalized.includes("weak password")) {
    return "رمز ساده است. ترکیبی از حرف و عدد با دست‌کم ۸ نویسه بگذار.";
  }
  if (normalized.includes("anonymous")) {
    // Guest sign-in is a project-level switch in Supabase. If it is off, the
    // button is there and does nothing, so say which door is still open.
    return "ورود مهمان فعلاً در دسترس نیست. با ایمیل وارد شو یا حساب بساز.";
  }
  return "کار پیش نرفت. دوباره بزن؛ اگر باز هم نشد، چند دقیقه بعد امتحان کن.";
}

/**
 * Where the links in confirmation and reset emails point. Falls back to the
 * domain Vercel injects, so a deployment cannot silently mail out localhost
 * links because someone forgot to set a variable.
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
  if (!parsed.success) return { error: "رمز باید دست‌کم ۸ نویسه باشد." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) return { error: translateAuthError(error.message) };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signInWithGoogle(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: appUrl("/callback") },
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
