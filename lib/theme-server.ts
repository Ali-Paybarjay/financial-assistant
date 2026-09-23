import "server-only";

import { cookies } from "next/headers";
import { DEFAULT_THEME, isTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

/**
 * The theme the server should render with.
 *
 * Read from a cookie rather than from the profile row: `<html data-theme>` is
 * written before any query runs, and a theme that arrives one round trip late
 * is a white flash on a dark phone. The profile copy is the durable one — see
 * saveTheme in app/(app)/settings/actions.ts — and this cookie is refreshed
 * from it whenever the user changes it.
 */
export async function themeFromCookie(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : DEFAULT_THEME;
}
