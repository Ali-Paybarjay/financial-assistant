"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and through the first client render; true from the
 * moment React has taken the page over.
 *
 * Used to hold the auth forms' submit buttons shut until their JavaScript is
 * actually in charge. Those forms do their work in `onSubmit`, so a click that
 * lands before hydration is a *native* submit — and the browser's idea of a
 * native submit is whatever `method` says. `method="post"` is what stops a
 * password ending up in a URL; this is what stops the user meeting a 405 for
 * having been quick.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
