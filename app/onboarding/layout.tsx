import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { GuestBanner } from "@/components/guest/guest-banner";
import { GuestProvider } from "@/components/guest/guest-provider";
import { GuestWelcome } from "@/components/guest/guest-welcome";

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

  // Onboarding is a full-bleed flow on `surface`, with no tab bar: the only
  // thing on screen should be the current question.
  return (
    <GuestProvider isGuest={user.is_anonymous === true}>
      <div className="min-h-dvh bg-surface">
        <GuestBanner />
        {children}
      </div>
      <GuestWelcome />
    </GuestProvider>
  );
}
