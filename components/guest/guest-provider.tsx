"use client";

import { createContext, useContext } from "react";

const GuestContext = createContext(false);

/**
 * Whether the person is signed in anonymously, read from the session in the two
 * layouts and handed down from there. A context rather than a prop because the
 * pieces that need it — the exit sheet buried inside seven onboarding steps,
 * the sign-out row in settings — are nowhere near the layout that knows.
 */
export function GuestProvider({
  isGuest,
  children,
}: {
  isGuest: boolean;
  children: React.ReactNode;
}) {
  return <GuestContext.Provider value={isGuest}>{children}</GuestContext.Provider>;
}

export function useIsGuest(): boolean {
  return useContext(GuestContext);
}
