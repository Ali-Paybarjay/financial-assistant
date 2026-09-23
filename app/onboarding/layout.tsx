import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GuestBanner } from "@/components/guest/guest-banner";
import { GuestProvider } from "@/components/guest/guest-provider";
import { GuestWelcome } from "@/components/guest/guest-welcome";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A guest lands here first, so this is where the welcome notice actually
  // fires. The getUser call is shared with the pages underneath through React's
  // cache, so reading the session here costs nothing extra.
  const user = await getSessionUser();

  if (!user) redirect("/login");

  // Whether this is still the way into the app or a form being revisited from
  // settings. The exit control at the top of every step is a different thing
  // in the two cases, and it sits too deep to be told by a prop.
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .single();

  // Onboarding is a full-bleed flow on `surface`, with no tab bar: the only
  // thing on screen should be the current question.
  return (
    <GuestProvider isGuest={user.is_anonymous === true}>
      <OnboardingProvider completed={Boolean(profile?.onboarding_completed_at)}>
        <div className="min-h-dvh bg-surface">
          <GuestBanner />
          {children}
        </div>
        <GuestWelcome />
      </OnboardingProvider>
    </GuestProvider>
  );
}
