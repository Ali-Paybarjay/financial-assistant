import { LoginForm } from "./login-form";
import { FormError } from "@/components/field";

const LINK_ERRORS: Record<string, string> = {
  expired_link: "این لینک منقضی شده. یک لینک تازه بگیر.",
  missing_code: "لینک ناقص بود. دوباره از ایمیلت روی لینک بزن.",
  cancelled: "ورود با گوگل نیمه‌کاره ماند. دوباره بزن یا با ایمیل و رمز وارد شو.",
  google_failed: "ورود با گوگل تمام نشد. دوباره بزن یا با ایمیل و رمز وارد شو.",
  wrong_account: "آن حساب گوگل اینجا حسابی نداشت. با همان ایمیلی وارد شو که با آن ثبت‌نام کرده بودی.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? LINK_ERRORS[error] : undefined;

  return (
    <div className="flex flex-col gap-4">
      {message && <FormError>{message}</FormError>}
      <LoginForm />
    </div>
  );
}
