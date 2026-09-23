export type Theme = "light" | "dark" | "system";

export const THEME_COOKIE = "theme";
export const DEFAULT_THEME: Theme = "system";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Deliberately free of server imports.
 *
 * The v3 package shipped `themeFromCookie()` in this file, reading
 * `next/headers` at the top of it — and `theme-provider.tsx`, a client
 * component, imports the constants below. That pulls a server-only module
 * into the client bundle and the build refuses it outright. The reader moved
 * to lib/theme-server.ts; what is left here is what both sides can hold.
 */
