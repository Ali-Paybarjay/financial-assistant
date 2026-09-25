/**
 * Who counts as an admin.
 *
 * Deliberately the smallest module in the feature, with no `server-only` and
 * no `next/*` import: the middleware bundles it into the edge runtime, and
 * anything server-flavoured in here would break that build. Everything else
 * admin-shaped lives behind `server-only` in lib/admin/auth.ts.
 *
 * `app_metadata`, never `user_metadata`. The difference is the whole security
 * model: `user_metadata` is writable by the user through `auth.updateUser()`,
 * so reading a role out of it would let anyone with an account promote
 * themselves in one call. `app_metadata` can only be written with the service
 * role — here, only by scripts/grant-admin.mjs.
 */

/** The shape this needs off a Supabase user; the real `User` satisfies it. */
export type WithAppMetadata = {
  app_metadata?: Record<string, unknown> | null;
};

export const ADMIN_ROLE = "admin";

export function isAdmin(user: WithAppMetadata | null | undefined): boolean {
  return user?.app_metadata?.role === ADMIN_ROLE;
}

/** Where the panel lives. One definition, so the gate and the nav agree. */
export const ADMIN_PATH = "/admin";

/**
 * `/admin` and everything under it — but not `/administrators`, which is not
 * this app's page and must not be gated by an accident of prefix matching.
 * Same rule `isUnder` applies in lib/workspaces.ts.
 */
export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);
}
