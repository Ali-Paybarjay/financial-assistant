import { requireAdmin } from "@/lib/admin/auth";
import { appSettings } from "@/lib/settings-server";
import { AdminPage } from "@/components/admin/page-shell";
import { SettingsForm } from "./settings-form";

/**
 * The five numbers that should not need a deploy.
 *
 * Every one of them is something an operator wants to change during a bad
 * afternoon: the model's kill switch when the provider's credit runs out or
 * somebody is farming guest accounts, the ceilings, how long an abandoned guest
 * is kept, and a sentence to put above the app. Waiting out a build to turn the
 * model off is the wrong shape of slow.
 *
 * The constants in the code remain the defaults, per key — see lib/settings.ts.
 * A row that goes missing or a value that fails its schema leaves the app
 * behaving exactly as it shipped.
 */
export default async function AdminSettingsPage() {
  await requireAdmin();

  const settings = await appSettings();

  return (
    <AdminPage
      title="تنظیمات"
      subtitle="بدون deploy عوض می‌شوند و از درخواست بعدی اعمال می‌گردند"
    >
      <SettingsForm initial={settings} />
    </AdminPage>
  );
}
