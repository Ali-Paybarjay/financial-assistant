import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdmin, isAdminPath } from "@/lib/admin/claims";
import type { Database } from "./database.types";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/callback",
  // Not public in any useful sense — it carries no session cookie because
  // Vercel's scheduler is not a browser, so the gate below would bounce it to
  // /login and the nightly sweep would quietly never run. It authenticates
  // itself against CRON_SECRET and refuses outright when that is unset.
  "/api/cron",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Refreshes the auth cookie and gates private routes. The onboarding redirect
 * lives in the (app) layout instead — it needs the profile row, and putting a
 * table read on every request here would tax static assets too.
 *
 * The admin gate *does* live here, and it is the only one: a server action is a
 * POST to a path this matcher covers, so gating in the layout alone would leave
 * every admin action reachable by anyone who knew the action id. It costs
 * nothing — `getUser()` below already returns `app_metadata`, so the claim is in
 * hand and no query is added.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser revalidates the token with the auth server; getSession would trust
  // a cookie the client could have edited.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 404, not 403: a page that says «you are not allowed here» has told whoever
  // asked that the page is there. Rewritten to a path no route owns, so
  // app/not-found.tsx renders with a real 404 status.
  //
  // Refreshed cookies are dropped on this branch, the same trade the redirect
  // above already makes — a request that is not being served the app does not
  // need its session rotated.
  if (isAdminPath(pathname) && !isAdmin(user)) {
    const url = request.nextUrl.clone();
    url.pathname = "/404";
    url.search = "";
    return NextResponse.rewrite(url);
  }

  return response;
}
