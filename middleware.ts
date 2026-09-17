import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // The manifest has to stay public: a browser fetches it without the
    // session cookie, and redirecting it to /login silently kills the
    // "add to home screen" prompt.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
