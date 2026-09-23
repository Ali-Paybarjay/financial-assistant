import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { GuestProvider } from "@/components/guest/guest-provider";
import { getSessionUser } from "@/lib/auth";
import { EMAIL_AUTH_ENABLED } from "@/lib/auth-methods";
import { SaveAccountForm } from "./save-account-form";

/** What the callback sends back here when the Google trip did not finish. */
const RETURN_ERRORS: Record<string, string> = {
  google_failed: EMAIL_AUTH_ENABLED
    ? "ورود با گوگل تمام نشد. دوباره بزن یا با ایمیل و رمز حساب بساز."
    : "ورود با گوگل تمام نشد. چیزی از دست نرفت — دوباره بزن.",
};

/**
 * Reachable from the guest banner, the welcome sheet, the exit sheet and
 * settings. It lives outside the (app) group on purpose: a guest who is still
 * part-way through onboarding must be able to secure their account without that
 * layout's onboarding gate bouncing them back to the step they were on.
 */
export default async function SaveAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string; error?: string }>;
}) {
  const user = await getSessionUser();
  const { linked, error } = await searchParams;

  if (!user) redirect("/login");

  // Coming back from a Google link that worked. Checked before the
  // `is_anonymous` redirect below, because that is exactly what a successful
  // link changes — and being bounced to settings is a strange answer to a
  // button labelled «keep my data».
  if (linked === "google") {
    return (
      <div className="flex flex-col gap-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-positive-tint">
          <CheckCircle size={24} weight="fill" className="text-positive" />
        </span>
        <h1 className="font-display text-question font-bold text-ink">حسابت ذخیره شد</h1>
        <p className="text-body text-ink-muted">
          از این به بعد با همین گوگل وارد می‌شوی. هر چیزی که تا حالا ثبت کرده‌ای
          همان‌جاست — چیزی جابه‌جا یا پاک نشد.
        </p>
        <Button asChild size="lg">
          <Link href="/">برگرد به نرم‌افزار</Link>
        </Button>
      </div>
    );
  }

  if (!user.is_anonymous) redirect("/settings");

  // The page's own guarantee, handed to the pieces that need it. Without this
  // the sign-out button reads the context default — «not a guest» — and skips
  // the confirmation on the one screen where the person is certainly a guest
  // with something to lose.
  return (
    <GuestProvider isGuest>
      <SaveAccountForm
        emailEnabled={EMAIL_AUTH_ENABLED}
        returnError={error ? RETURN_ERRORS[error] : undefined}
      />
    </GuestProvider>
  );
}
