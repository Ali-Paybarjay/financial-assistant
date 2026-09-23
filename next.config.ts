import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second Next process in this directory fights the first one over .next —
  // the build manifest is rewritten under the running server and pages start
  // 404ing for no reason visible in either log. Setting NEXT_DIST_DIR gives a
  // parallel dev server or build its own directory to own. Unset everywhere
  // that matters, so the default is untouched.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  devIndicators: {
    // Dev-only, and moved for a layout reason: this app is RTL, so `end` is the
    // left side — which is where the floating action button and every sheet's
    // destructive button sit. The badge's default bottom-left corner lands on
    // top of them at 375px and swallows the clicks, including Playwright's.
    position: "top-right",
  },
};

export default nextConfig;
