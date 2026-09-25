import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "./claims";

/**
 * The gate, on the server side of every admin page and every admin action.
 *
 * The middleware already turns `/admin` into a 404 for anyone without the
 * claim, so in practice this never fires. It is here anyway, because a server
 * action is a POST to a route the middleware matcher covers today and might
 * not cover tomorrow, and «the only check is in middleware» is one config
 * change away from no check at all.
 *
 * notFound() rather than a 403: a page that says «you are not allowed here»
 * has told an attacker the page exists. Signed-out visitors get the login
 * redirect instead, which is what every other private route does and reveals
 * nothing extra — /admin is not a secret from the person who owns the app.
 */
export async function requireAdmin(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();
  return user;
}

/**
 * Whether the *token* has caught up with the grant.
 *
 * Two clocks: `getSessionUser()` round-trips to the auth server and sees
 * `app_metadata` as it is right now, while Postgres reads `auth.jwt()` — the
 * access token the browser is holding, which keeps whatever claims it was
 * minted with until it refreshes (up to an hour) or the user signs in again.
 *
 * So for that hour, requireAdmin() lets you in and every report raises 42501.
 * The layout asks this once and says the one sentence that fixes it, because
 * the alternative is a page of error tiles that looks like the feature is
 * broken.
 */
export const adminJwtIsFresh = cache(async function adminJwtIsFresh(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
});
