import { requireAdmin, adminJwtIsFresh } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminPage, AdminCard } from "@/components/admin/page-shell";
import { SignOutButton } from "@/components/sign-out";
import { createClient } from "@/lib/supabase/server";

/**
 * The panel's own shell, a sibling of `(app)` rather than a page inside it.
 *
 * That placement is the whole design. Under `(app)` this would inherit the
 * onboarding gate, the guest provider, the composer bar and the tab bar — so an
 * operator reading somebody's failed import would have a field at the bottom of
 * the screen offering to record a purchase into their own ledger. Out here it
 * inherits the root layout and nothing else: same fonts, same theme cookie,
 * same RTL document, none of the app's chrome.
 *
 * It also means an admin who never finished onboarding can still use the panel,
 * which is right — the panel is not part of their financial picture.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware has already turned this path into a 404 for anyone without the
  // claim. This is the second lock, on the chance the matcher ever changes.
  const user = await requireAdmin();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.full_name ?? "مدیر";

  // Two clocks, and this is where they disagree. `requireAdmin()` asked the
  // auth server and let us in; Postgres reads the claim out of the access token
  // the browser is holding, which keeps its old claims until it refreshes. In
  // that window every report on every page raises «admin only» — a page full of
  // red boxes that looks exactly like a broken feature.
  //
  // So it is asked once, here, and answered with the one sentence that fixes
  // it. See adminJwtIsFresh().
  if (!(await adminJwtIsFresh())) {
    return (
      <AdminShell name={name} email={user.email ?? null}>
        <AdminPage title="یک قدم مانده">
          <AdminCard>
            <p className="text-body text-ink">
              دسترسی مدیریت برایت فعال شده، ولی توکن این مرورگر هنوز خبر ندارد.
            </p>
            <p className="mt-2 text-caption text-ink-muted">
              خارج شو و دوباره وارد شو — یا تا یک ساعت صبر کن تا توکن خودش تازه
              شود. تا آن موقع صفحه‌های پنل خالی می‌مانند.
            </p>
            <div className="mt-4">
              <SignOutButton />
            </div>
          </AdminCard>
        </AdminPage>
      </AdminShell>
    );
  }

  return (
    <AdminShell name={name} email={user.email ?? null}>
      {children}
    </AdminShell>
  );
}
