import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell/shell";
import { GuestProvider } from "@/components/guest/guest-provider";
import { GuestWelcome } from "@/components/guest/guest-welcome";
import { RISK_LABELS } from "@/lib/onboarding/config";
import { COUNTRIES } from "@/lib/onboarding/config";

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
    .select("full_name, country_code, base_currency, risk_label, onboarding_step, onboarding_completed_at")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  if (!profile.onboarding_completed_at) {
    const step = Math.min(Math.max(profile.onboarding_step + 1, 1), 7);
    redirect(`/onboarding/${step}`);
  }

  const country = COUNTRIES.find((entry) => entry.code === profile.country_code);
  const subtitle = [
    country?.name,
    profile.base_currency,
    profile.risk_label ? RISK_LABELS[profile.risk_label] : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <GuestProvider isGuest={user.is_anonymous === true}>
      <AppShell name={profile.full_name ?? "حساب من"} subtitle={subtitle}>
        {children}
      </AppShell>
      <GuestWelcome />
    </GuestProvider>
  );
}
