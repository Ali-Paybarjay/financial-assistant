import type { MetadataRoute } from "next";

/**
 * Enough to install to a home screen: an icon, a name, and a standalone
 * window with no browser chrome. Deliberately not a service worker — offline
 * support is out of scope, and a half-working cache on financial data is
 * worse than none.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "دستیار مالی",
    short_name: "دستیار مالی",
    description: "ثبت سریع هزینه و دیدن مانده‌ی این ماه",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // --paper in the light theme. A manifest is static JSON with no media
    // query, so it names one of the two; the <meta name="theme-color"> pair
    // in app/layout.tsx is what actually follows the theme at runtime.
    background_color: "#edecf2", // theme-ok
    theme_color: "#edecf2", // theme-ok
    dir: "rtl",
    lang: "fa",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
