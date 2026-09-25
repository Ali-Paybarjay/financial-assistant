/**
 * Makes someone an admin, or stops them being one.
 *
 * This is the only way the claim is ever written. There is no UI for it on
 * purpose: a single-operator product does not need one, and a page that can
 * create admins is a page worth attacking. The claim lives in
 * `app_metadata`, which only the service role can write — see
 * lib/admin/claims.ts for why that matters.
 *
 * Usage:
 *   pnpm admin:grant someone@example.com
 *   pnpm admin:grant someone@example.com --revoke
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function env(key) {
  if (process.env[key]) return process.env[key];
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const at = line.indexOf("=");
    if (at > 0 && line.slice(0, at).trim() === key) {
      return line.slice(at + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error(`${key} is not set, and .env.local does not define it`);
}

const args = process.argv.slice(2);
const revoking = args.includes("--revoke");
const email = args.find((arg) => !arg.startsWith("--"));

if (!email) {
  console.error("usage: pnpm admin:grant <email> [--revoke]");
  process.exit(1);
}

const db = createClient(
  env("NEXT_PUBLIC_SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);

// listUsers is paged; one page is plenty for a project with one operator, and
// asking for more than the first page would only matter once there are a
// thousand accounts — at which point this script needs a real lookup anyway.
const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw new Error(`listUsers: ${listError.message}`);

const user = list.users.find((candidate) => candidate.email === email);
if (!user) {
  console.error(`No account with the address ${email}.`);
  console.error("They have to sign in once before they can be made an admin.");
  process.exit(1);
}

if (user.is_anonymous) {
  console.error("That is a guest account. A guest cannot be an admin.");
  process.exit(1);
}

// Spread, never replace: app_metadata is also where GoTrue keeps `provider`
// and `providers`, and overwriting the object would strip the record of how
// this person signs in.
const { error } = await db.auth.admin.updateUserById(user.id, {
  app_metadata: { ...user.app_metadata, role: revoking ? null : "admin" },
});

if (error) throw new Error(`updateUserById: ${error.message}`);

console.log(
  revoking
    ? `${email} is no longer an admin.`
    : `${email} is an admin. The panel is at /admin.`,
);

// The half that is easy to leave out and confusing to hit. Next sees the change
// immediately (getUser() asks the auth server), but Postgres reads the claim
// out of the access token the browser is holding — so until that refreshes,
// /admin opens and every report on it raises «admin only». The layout says so
// too, but by then the operator has already seen a broken-looking page.
console.log("");
console.log("Sign out and back in for it to take effect — the claim travels in");
console.log("the access token, which keeps its old claims for up to an hour.");
