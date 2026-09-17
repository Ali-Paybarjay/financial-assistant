import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    // Dev-only, and moved for a layout reason: this app is RTL, so `end` is the
    // left side — which is where the floating action button and every sheet's
    // destructive button sit. The badge's default bottom-left corner lands on
    // top of them at 375px and swallows the clicks, including Playwright's.
    position: "top-right",
  },
};

export default nextConfig;
