import { redirect } from "next/navigation";
import { UserCircle } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { AccountExistsChoice } from "./choice";

/** What the callback sends back here when the trip to Google did not land. */
const RETURN_ERRORS: Record<string, string> = {
  google_failed: "ورود با گوگل تمام نشد. چیزی از دست نرفت — دوباره بزن.",
  // The chooser was answered with an address that has no account here. Said
  // plainly, because the obvious reading of «it did not work» would be that
  // the app is broken, when in fact one line of the list was the wrong one.
  wrong_account:
    "آن حساب گوگل اینجا حسابی ندارد، پس حساب قبلی‌ات نبود. چیزی از دست نرفت — دوباره بزن و این بار همان ایمیلی را انتخاب کن که با آن ثبت‌نام کرده بودی.",
};

/**
 * «This Google account is already yours.»
 *
 * The one fork a guest signing in with Google can hit that is neither success
 * nor error: linking was refused because the identity belongs to a user who
 * already exists here — which is to say, to them, on a day they had forgotten
 * about. GoTrue will not merge the two, and it should not: two ledgers are not
 * automatically one ledger, and a salary counted twice is worse than a month
 * re-entered by hand.
 *
 * So the decision is handed back, with the cost of each side written out.
 * Nothing has happened yet when this page loads — the link failed, so the guest
 * session is exactly as it was — and nothing happens on the way out either: the
 * guest is taken down in /callback, once the other account has actually been
 * signed in to.
 */
export default async function AccountExistsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  const { error } = await searchParams;

  if (!user) redirect("/login");
  // Whoever is no longer a guest has nothing left to decide here — either the
  // link went through after all, or they arrived by typing the address.
  if (!user.is_anonymous) redirect("/");

  const supabase = await createClient();

  // What leaving actually costs, counted rather than described. «Everything
  // you entered» is a phrase; «۲۳ تراکنش» is a number someone can weigh.
  // RLS scopes all four to this guest without a single filter.
  const [transactions, accounts, goals, trips] = await Promise.all([
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase.from("accounts").select("id", { count: "exact", head: true }),
    supabase.from("goals").select("id", { count: "exact", head: true }),
    supabase.from("dong_groups").select("id", { count: "exact", head: true }),
  ]);

  const guestData = [
    { label: "تراکنش", count: transactions.count ?? 0 },
    { label: "حساب", count: accounts.count ?? 0 },
    { label: "هدف", count: goals.count ?? 0 },
    { label: "دنگ", count: trips.count ?? 0 },
  ].filter((entry) => entry.count > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="flex size-12 items-center justify-center rounded-full bg-action-tint">
          <UserCircle size={24} className="text-action" />
        </span>
        <h1 className="mt-4 font-display text-question font-bold text-ink">
          با این حساب گوگل قبلاً ثبت‌نام کرده‌ای
        </h1>
        <p className="mt-2 text-body text-ink-muted">
          پس لازم نیست حساب تازه بسازی — فقط وارد همان حساب شو. اطلاعاتش سر
          جایش است.
        </p>
      </div>

      <AccountExistsChoice
        guestData={guestData}
        returnError={RETURN_ERRORS[error ?? ""]}
      />
    </div>
  );
}
