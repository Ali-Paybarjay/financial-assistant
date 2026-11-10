/**
 * Why the base currency cannot be changed once money has been recorded.
 *
 * A module of its own rather than an export from either action file, because
 * both of them are `"use server"` — and a `"use server"` module may only export
 * functions. A string constant there passes typecheck and fails the build.
 *
 * The rule itself lives in two places on purpose: the probe that answers «is
 * there money?» is lib/queries/money-data.ts, and the two writers that ask it
 * are settings' `updateCurrency` and onboarding's `saveStep1`. This is the one
 * sentence they both say when the answer is yes. See F01.
 */
export const CURRENCY_LOCKED_ERROR =
  "ارز پایه را نمی‌شود عوض کرد، چون مبلغ‌هایی با ارز فعلی ثبت شده‌اند و این کار آن‌ها را تبدیل نمی‌کند — فقط برچسبشان را عوض می‌کند. برای شروع با ارز دیگر، اول داده‌های پولی را حذف کن یا حساب تازه بساز.";
