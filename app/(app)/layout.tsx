import { headers } from "next/headers";
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
import type { CaptureData } from "@/components/entry/capture-sheet";
import { GuestProvider } from "@/components/guest/guest-provider";
import { GuestWelcome } from "@/components/guest/guest-welcome";
import { COUNTRIES, TOTAL_STEPS } from "@/lib/onboarding/config";
import { PATHNAME_HEADER, workspaceForPath } from "@/lib/workspaces";
import { appSettings } from "@/lib/settings-server";

/**
 * The protected shell. Middleware has already guaranteed a session; this layer
 * adds the onboarding gate, which needs the profile row.
 *
 * Which of the two workspaces the chrome belongs to is decided inside
 * <AppShell>, from the url — a server layout is not told the path, so the chrome
 * is drawn on the client. What the layout *fetches* is decided here, from the
 * path middleware wrote onto the request: see PATHNAME_HEADER.
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

  const viewer = await requireViewer();

  /**
   * Whether this page has a composer on it, and therefore whether the composer's
   * four queries are worth making.
   *
   * They used to be made on every signed-in page. «دنگ و دونگ» has no composer —
   * rule 11: a free-text bar that writes to the personal ledger has no business
   * on a page about other people's money — and the chooser has no nav at all, so
   * both of them were paying for this month's envelopes, every account's derived
   * balance and every goal's progress in order to render none of it.
   *
   * A path the header did not arrive on falls back to fetching, which is what
   * every page did before. Getting this wrong in the cheap direction costs four
   * queries; getting it wrong in the other direction costs a missing composer.
   */
  const pathname = (await headers()).get(PATHNAME_HEADER);
  const wantsComposer = pathname === null || workspaceForPath(pathname) === "personal";

  const settings = await appSettings();
  const entry = wantsComposer ? await captureData(viewer.currency, viewer.timeZone) : null;

  const country = COUNTRIES.find((entry) => entry.code === profile.country_code);
  const subtitle = [country?.name, profile.base_currency].filter(Boolean).join(" · ");

  return (
    <GuestProvider isGuest={user.is_anonymous === true}>
      <AppShell
        name={profile.full_name ?? "حساب من"}
        subtitle={subtitle}
        banner={settings.maintenance_banner}
        entry={entry}
      >
        {children}
      </AppShell>
      <GuestWelcome />
    </GuestProvider>
  );
}

/**
 * Everything the composer needs to record a purchase, read once for the whole
 * personal side rather than per page — the bar is on every one of them, which is
 * the point of it replacing a button that was on two.
 */
async function captureData(
  currency: CaptureData["currency"],
  timeZone: string,
): Promise<CaptureData> {
  const today = todayInTimeZone(timeZone);
  const month = monthRange(timeZone, today).month;

  const [categories, accounts, goals, envelopes] = await Promise.all([
    listCategories(),
    listAccountsWithBalances(),
    listGoalsWithProgress(),
    listEnvelopes(month),
  ]);

  return {
    currency,
    categories,
    accounts,
    goals: goals.filter((goal) => goal.status === "active"),
    envelopes,
    defaultAccountId: preferredAccountId(accounts),
    today,
  };
}
