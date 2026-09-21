import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Exchanges the one-time code from an email link or OAuth round-trip for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=expired_link`);
  }

  // Only same-origin relative paths, so a crafted link cannot bounce the user
  // off-site with a fresh session in hand.
  const destination = next.startsWith("/") ? next : "/";
  return NextResponse.redirect(`${origin}${destination}`);
}
