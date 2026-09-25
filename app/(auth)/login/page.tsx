import { LoginForm } from "./login-form";
import { FormError } from "@/components/field";
import { EMAIL_AUTH_ENABLED, showsPasswordLogin } from "@/lib/auth-methods";

// «Or use email» is only advice while there is an email form to use.
const RETRY = EMAIL_AUTH_ENABLED ? "دوباره بزن یا با ایمیل و رمز وارد شو." : "دوباره بزن.";

const LINK_ERRORS: Record<string, string> = {
  expired_link: "این لینک منقضی شده. یک لینک تازه بگیر.",
  missing_code: "لینک ناقص بود. دوباره از ایمیلت روی لینک بزن.",
  cancelled: `ورود با گوگل نیمه‌کاره ماند. ${RETRY}`,
  google_failed: `ورود با گوگل تمام نشد. ${RETRY}`,
  wrong_account: "آن حساب گوگل اینجا حسابی نداشت. با همان ایمیلی وارد شو که با آن ثبت‌نام کرده بودی.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; method?: string; next?: string }>;
}) {
  const { error, method, next } = await searchParams;
  const message = error ? LINK_ERRORS[error] : undefined;

  return (
    <div className="flex flex-col gap-4">
      {message && <FormError>{message}</FormError>}
      <LoginForm showPassword={showsPasswordLogin(method)} next={next} />
    </div>
  );
}
