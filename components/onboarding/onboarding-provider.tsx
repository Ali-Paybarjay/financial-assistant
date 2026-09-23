"use client";

import { createContext, useContext } from "react";

const OnboardingCompletedContext = createContext(false);

/**
 * Whether the person has already been let into the app.
 *
 * False while the flow is still the way in. True when they have come back
 * from settings to fill in something they skipped — the same seven screens,
 * but «leave» means sign out in the first case and «back to settings» in the
 * second, and the button that has to know is buried under a form, in a shell,
 * in a step. A context for the same reason the guest flag is one.
 */
export function OnboardingProvider({
  completed,
  children,
}: {
  completed: boolean;
  children: React.ReactNode;
}) {
  return (
    <OnboardingCompletedContext.Provider value={completed}>
      {children}
    </OnboardingCompletedContext.Provider>
  );
}

export function useOnboardingCompleted(): boolean {
  return useContext(OnboardingCompletedContext);
}
