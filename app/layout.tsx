import type { Metadata, Viewport } from "next";
import "./globals.css";
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
  themeColor: "#f1f3f6",
  width: "device-width",
  initialScale: 1,
  // The amount field is 16px so iOS will not zoom on focus; this stops a
  // pinch-zoom from leaving the layout stranded mid-entry.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
