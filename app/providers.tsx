"use client";

import { Direction } from "radix-ui";

/**
 * The one client provider the app has.
 *
 * It used to hold a React Query client as well. Nothing ever used it: a search
 * of app, components and lib found no `useQuery` and no `useMutation`, because
 * every read in this product is a server component and every write is a server
 * action. What the provider did was ship the library to the browser and give two
 * components a `queryClient.clear()` to call on sign-out — a cache clear over an
 * empty cache, defending against a leak that could not happen.
 *
 * The guarantee it was defending is real and is kept elsewhere: `logout()` calls
 * `revalidatePath("/", "layout")` before redirecting, which is what actually
 * drops the previous account's rendered pages out of the client router cache. See
 * app/(auth)/actions.ts.
 *
 * If a client-side cache is ever wanted — an infinite ledger, optimistic entry —
 * this is where it goes back, with a note saying what reads through it.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // Radix primitives read direction from this provider, not from the <html>
  // dir attribute. Without it, dropdowns and selects open on the wrong side.
  return <Direction.Provider dir="rtl">{children}</Direction.Provider>;
}
