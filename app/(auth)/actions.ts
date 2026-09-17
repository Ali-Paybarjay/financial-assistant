"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
  redirect("/dashboard");
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
      emailRedirectTo: appUrl("/callback?next=/onboarding/1"),
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
  redirect("/dashboard");
}

export async function signInWithGoogle(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: appUrl("/callback?next=/dashboard") },
  });

  if (error) return { error: translateAuthError(error.message) };
  if (data.url) redirect(data.url);
  return { error: "ورود با گوگل در دسترس نیست. با ایمیل و رمز وارد شو." };
}

export async function logout(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
