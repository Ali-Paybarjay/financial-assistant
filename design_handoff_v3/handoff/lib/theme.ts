import { cookies } from "next/headers";

export type Theme = "light" | "dark" | "system";

export const THEME_COOKIE = "theme";
export const DEFAULT_THEME: Theme = "system";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * The theme the server should render with.
 *
 * Read from a cookie rather than from the profile row: the html element is
 * written before any query runs, and a theme that arrives one round-trip late
 * is a white flash on a dark phone. The profile copy is the durable one — see
 * saveTheme in app/(app)/settings/actions.ts — and the cookie is refreshed
 * from it whenever the user changes it.
 */
export async function themeFromCookie(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : DEFAULT_THEME;
}
