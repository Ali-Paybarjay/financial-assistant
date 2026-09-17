import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app-shell/sidebar";
import { TabBar } from "@/components/app-shell/tab-bar";
import { RISK_LABELS } from "@/lib/onboarding/config";
import { COUNTRIES } from "@/lib/onboarding/config";

/**
 * The protected shell. Middleware has already guaranteed a session; this layer
 * adds the onboarding gate, which needs the profile row.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
    <div className="flex min-h-dvh bg-paper">
      <Sidebar name={profile.full_name ?? "حساب من"} subtitle={subtitle} />
      {/* pb-20 clears the fixed tab bar; it disappears with the bar at 960px. */}
      <main className="min-w-0 flex-1 pb-20 min-[960px]:pb-0">{children}</main>
      <TabBar />
    </div>
  );
}
