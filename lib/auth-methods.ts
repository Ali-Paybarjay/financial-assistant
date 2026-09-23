/**
 * Which ways into the app are offered.
 *
 * Email is off for now. The project sends mail through Supabase's built-in
 * service, which allows about two messages an hour for the whole project and
 * only delivers to the team's own addresses — so sign-up, «forgot password»
 * and a guest saving their account by email all die at the confirmation link
 * (measured 2026-09-23: three sign-ups in a row answered
 * `over_email_send_rate_limit`). Google needs no email and is the one door
 * that works, so it is the one door shown.
 *
 * Flip this back once custom SMTP is wired up; the checklist is in
 * DECISIONS.md under «ورود فقط با گوگل». Everything email-shaped is still in
 * the tree behind this flag — pages, actions, forms — so turning it on is one
 * line, not a rebuild.
 */
export const EMAIL_AUTH_ENABLED = false;

/**
 * The side entrance for the password form: /login?method=password.
 *
 * The e2e suite signs in as two fixture accounts that have no Google
 * identity, and there is no way to drive a Google consent screen from
 * Playwright. This is a product choice, not a security boundary — the
 * endpoints behind the form are the same whether or not it is drawn.
 */
export const PASSWORD_LOGIN_METHOD = "password";

export function showsPasswordLogin(method: string | undefined): boolean {
  return EMAIL_AUTH_ENABLED || method === PASSWORD_LOGIN_METHOD;
}

/** What every email-shaped action answers while the flag is off. */
export const EMAIL_AUTH_OFF_MESSAGE =
  "فعلاً ثبت‌نام و ورود با ایمیل در دسترس نیست. با گوگل وارد شو.";
