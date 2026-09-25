import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, requireViewer } from "@/lib/auth";
import { listCategories } from "@/lib/queries/categories";
import { listAccountsWithBalances } from "@/lib/queries/accounts";
import { listGoalsWithProgress } from "@/lib/queries/goals";
import { listEnvelopes } from "@/lib/queries/envelopes";
import { preferredAccountId } from "@/lib/accounts";
import { monthRange, todayInTimeZone } from "@/lib/date";
import { AppShell } from "@/components/app-shell/shell";
import { GuestProvider } from "@/components/guest/guest-provider";
import { GuestWelcome } from "@/components/guest/guest-welcome";
import { COUNTRIES, TOTAL_STEPS } from "@/lib/onboarding/config";

/**
 * The protected shell. Middleware has already guaranteed a session; this layer
 * adds the onboarding gate, which needs the profile row.
 *
 * Which of the two workspaces the chrome belongs to is decided inside
 * <AppShell>, from the url — a server layout is not told the path.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    // No `risk_label` here. It was dropped in migration 0025 along with the
    // questions that filled it, and while the column was gone but this select
    // still named it, PostgREST refused the whole request rather than
    // returning a row with a hole in it: `profile` came back null, the guard
    // three lines down read that as «not signed in», and every signed-in page
    // answered ERR_TOO_MANY_REDIRECTS. A column drop ships after the code that
    // stops reading it, not before.
    .select("full_name, country_code, base_currency, onboarding_step, onboarding_completed_at")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  if (!profile.onboarding_completed_at) {
    const step = Math.min(Math.max(profile.onboarding_step + 1, 1), TOTAL_STEPS);
    redirect(`/onboarding/${step}`);
  }

  // Everything the composer needs, read once here. The bar is on every page,
  // which is the point of it replacing a button that was on two of them.
  const viewer = await requireViewer();
  const today = todayInTimeZone(viewer.timeZone);
  const month = monthRange(viewer.timeZone, today).month;

  const [categories, accounts, goals, envelopes] = await Promise.all([
    listCategories(),
    listAccountsWithBalances(),
    listGoalsWithProgress(),
    listEnvelopes(month),
  ]);

  const country = COUNTRIES.find((entry) => entry.code === profile.country_code);
  const subtitle = [country?.name, profile.base_currency]
    .filter(Boolean)
    .join(" · ");

  return (
    <GuestProvider isGuest={user.is_anonymous === true}>
      <AppShell
        name={profile.full_name ?? "حساب من"}
        subtitle={subtitle}
        entry={{
          currency: viewer.currency,
          categories,
          accounts,
          goals: goals.filter((goal) => goal.status === "active"),
          envelopes,
          defaultAccountId: preferredAccountId(accounts),
          today,
        }}
      >
        {children}
      </AppShell>
      <GuestWelcome />
    </GuestProvider>
  );
}
