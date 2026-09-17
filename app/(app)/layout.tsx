import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    .select("onboarding_step, onboarding_completed_at")
    .eq("id", user.id)
    .single();

  if (profile && !profile.onboarding_completed_at) {
    const step = Math.min(Math.max(profile.onboarding_step + 1, 1), 7);
    redirect(`/onboarding/${step}`);
  }

  return <div className="min-h-dvh bg-paper">{children}</div>;
}
