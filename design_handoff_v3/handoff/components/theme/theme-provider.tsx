"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";

type ThemeContextValue = {
  /** What the user chose: light, dark, or system. */
  theme: Theme;
  /** What that resolves to right now — for anything that needs the real one. */
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): "light" | "dark" {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Owns the one attribute the stylesheet reads: <html data-theme>.
 *
 * The value is written three places, on purpose:
 *   - the attribute, so the page repaints immediately;
 *   - a cookie, so the next server render starts in the right theme;
 *   - the profile (by the caller, through saveTheme), so a second device agrees.
 *
 * `initial` comes from the server so the first client render matches the
 * markup and React does not warn about a mismatch.
 */
export function ThemeProvider({
  initial,
  children,
}: {
  initial: Theme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initial);
  const [resolved, setResolved] = useState<"light" | "dark">(
    initial === "system" ? "light" : initial,
  );

  // Kept in an effect rather than in render: matchMedia does not exist on the
  // server, and reading it during render would make the first paint differ
  // from the markup the server sent.
  useEffect(() => {
    setResolved(theme === "system" ? systemTheme() : theme);
    if (theme !== "system") return;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(query.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    if (!isTheme(next)) return;
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    // One year, lax: it is a display preference, not a session.
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}

/**
 * Runs before the first paint, from <head>.
 *
 * Next writes data-theme on the server from the cookie, so this only has to
 * cover the case where there is no cookie yet — a first visit. Without it
 * that visit paints white and then flips, which on a phone at night is the
 * one bug users describe as «چشمم سوخت».
 */
export function ThemeScript({ initial }: { initial: Theme }) {
  const code = `try{var t=document.cookie.match(/(?:^|; )theme=(light|dark|system)/);document.documentElement.dataset.theme=t?t[1]:${JSON.stringify(
    initial,
  )}}catch(e){document.documentElement.dataset.theme=${JSON.stringify(initial)}}`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
