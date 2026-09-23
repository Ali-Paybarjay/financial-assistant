import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeFromCookie } from "@/lib/theme-server";
import { ThemeProvider, ThemeScript } from "@/components/theme/theme-provider";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "دستیار مالی",
  description: "ثبت سریع هزینه و دیدن مانده‌ی این ماه",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // iOS ignores the web manifest's display mode and reads these instead.
  appleWebApp: {
    capable: true,
    title: "دستیار مالی",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // One per theme, so the browser chrome around the page matches the page.
  // The values are --paper in each theme; they are literals because a
  // viewport export cannot read a stylesheet.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edecf2" }, // theme-ok
    { media: "(prefers-color-scheme: dark)", color: "#101120" }, // theme-ok
  ],
  width: "device-width",
  initialScale: 1,
  // The amount field is 16px so iOS will not zoom on focus; this stops a
  // pinch-zoom from leaving the layout stranded mid-entry.
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = await themeFromCookie();

  return (
    // suppressHydrationWarning because <ThemeScript> rewrites data-theme
    // before React hydrates: on a first visit with no cookie there is nothing
    // for the server to have known, and the attribute legitimately differs.
    <html lang="fa" dir="rtl" data-theme={theme} suppressHydrationWarning>
      <head>
        <ThemeScript initial={theme} />
        {/* Self-hosted, and only the two faces used above the fold are
            preloaded. Google Fonts is unreachable on sanctioned networks. */}
        <link
          rel="preload"
          href="/fonts/Vazirmatn-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Estedad-ExtraBold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ThemeProvider initial={theme}>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
