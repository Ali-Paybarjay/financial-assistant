export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Onboarding is a full-bleed flow on `surface`, with no tab bar: the only
  // thing on screen should be the current question.
  return <div className="min-h-dvh bg-surface">{children}</div>;
}
