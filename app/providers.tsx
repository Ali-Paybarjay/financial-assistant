"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Direction } from "radix-ui";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    // Radix primitives read direction from this provider, not from the <html>
    // dir attribute. Without it, dropdowns and selects open on the wrong side.
    <Direction.Provider dir="rtl">
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Direction.Provider>
  );
}
