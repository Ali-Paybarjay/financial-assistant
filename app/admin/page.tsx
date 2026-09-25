import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { adminOverview, adminSignupsDaily } from "@/lib/admin/queries";
import { appSettings } from "@/lib/settings-server";
import { getViewer } from "@/lib/auth";
import { addDays, formatDateFa, todayInTimeZone } from "@/lib/date";
import { faNumber } from "@/lib/format";
import { Money } from "@/components/money";
import { AdminPage, AdminCard, KeyValues } from "@/components/admin/page-shell";
import { KpiTile, TileGrid, TileGroup } from "@/components/admin/kpi-tile";
import { StatusPill } from "@/components/admin/status-pill";
import { SignupsChart } from "./signups-chart";

/**
 * What an operator opens first.
 *
 * One RPC for every figure on it. The overview is the page most likely to be
 * left open in a tab, so it is deliberately one round trip rather than fifteen
 * — and the counts it shows are the ones that answer «is anything wrong right
 * now», not the ones that are easiest to compute.
 */
export default async function AdminOverviewPage() {
  await requireAdmin();

  const viewer = await getViewer();
  const timeZone = viewer?.timeZone ?? "UTC";
  const settings = await appSettings();

  const today = todayInTimeZone(timeZone);
  const from = addDays(today, -13);

  const [overview, signups] = await Promise.all([
    adminOverview(timeZone, settings.guest_retention_days),
    adminSignupsDaily(from, today, timeZone),
  ]);

  if (!overview) {
    return (
      <AdminPage title="نمای کلی">
        <AdminCard>
          <p className="text-body text-ink-muted">گزارش چیزی برنگرداند.</p>
        </AdminCard>
      </AdminPage>
    );
  }

  const percent = (part: number, whole: number) =>
    whole === 0 ? "—" : `${faNumber(Math.round((part / whole) * 100))}٪`;

  // Every day in the window, including the empty ones — a bar chart built only
  // from days that have rows spaces them evenly and turns a quiet week into a
  // busy one.
  const days = Array.from({ length: 14 }, (_, index) => addDays(from, index));
  const byDay = new Map(signups.map((row) => [row.day, row]));
  const signupPoints = days.map((day) => ({
    day,
    guests: byDay.get(day)?.guests ?? 0,
    registered: byDay.get(day)?.registered ?? 0,
  }));

  const attempted = overview.ai_calls_7d - overview.ai_rate_limited_7d;

  return (
    <AdminPage
      title="نمای کلی"
      subtitle={`${formatDateFa(today)} · شمارش و تجمیع، بدون هیچ ردیف دفتری`}
    >
      <div className="flex flex-col gap-5">
        <TileGroup label="کاربران">
          <TileGrid>
            <KpiTile
              label="کل حساب‌ها"
              value={faNumber(overview.users_total)}
              hint={`${faNumber(overview.users_new_7d)} تازه در ۷ روز`}
            />
            <KpiTile
              label="ثبت‌نامی"
              value={faNumber(overview.users_registered)}
              hint={`${faNumber(overview.users_guests)} مهمان`}
            />
            <KpiTile
              label="آنبوردینگ تمام‌شده"
              value={faNumber(overview.users_onboarded)}
              hint={`${percent(overview.users_onboarded, overview.users_registered)} از ثبت‌نامی‌ها`}
            />
            <KpiTile
              label="فعال ۷ روز"
              value={faNumber(overview.users_active_7d)}
              hint={`${percent(overview.users_active_7d, overview.users_total)} از کل`}
            />
          </TileGrid>
        </TileGroup>

        <TileGroup label="دفتر">
          <TileGrid>
            <KpiTile
              label="تراکنش‌ها"
              value={faNumber(overview.transactions_total)}
              hint={`${faNumber(overview.transactions_7d)} در ۷ روز`}
            />
            <KpiTile
              label="دوره‌های دنگ"
              value={faNumber(overview.dong_groups_total)}
              hint={`${faNumber(overview.dong_groups_open)} تسویه‌نشده`}
            />
            <KpiTile
              label="فایل‌های آپلودی"
              value={faNumber(overview.media_count)}
              hint={megabytes(overview.media_bytes)}
            />
            <KpiTile
              label="صورت‌حساب‌های باز"
              value={faNumber(overview.imports_open)}
              tone={overview.imports_failed_7d > 0 ? "alarm" : "plain"}
              hint={
                overview.imports_failed_7d > 0 ? (
                  <Link href="/admin/imports?status=failed" className="text-negative underline">
                    {faNumber(overview.imports_failed_7d)} شکست‌خورده در ۷ روز
                  </Link>
                ) : (
                  "بدون شکست در ۷ روز"
                )
              }
            />
          </TileGrid>
        </TileGroup>

        <TileGroup label="هوش مصنوعی">
          <TileGrid>
            <KpiTile
              label="فراخوانی امروز"
              value={faNumber(overview.ai_calls_today)}
              hint={`${faNumber(overview.ai_calls_30d)} در ۳۰ روز`}
            />
            <KpiTile
              label="هزینهٔ ۳۰ روز"
              value={
                // The dashed rule is the app's own grammar for a figure nobody
                // has settled: logUsage rounds to whole cents and files a
                // sub-cent call as no cost at all, so this is a floor.
                <span className="rule-guess">
                  <Money minor={overview.ai_cost_cents_30d} currency="USD" />
                </span>
              }
              hint="تقریبی — زیر یک سنت ثبت نمی‌شود"
            />
            <KpiTile
              label="نرخ خطا ۷ روز"
              value={
                attempted > 0
                  ? `${faNumber(Math.round((overview.ai_failures_7d / attempted) * 1000) / 10)}٪`
                  : "—"
              }
              hint={`${faNumber(overview.ai_failures_7d)} از ${faNumber(attempted)}`}
            />
            <KpiTile
              label="برخورد به سقف ۷ روز"
              value={faNumber(overview.ai_rate_limited_7d)}
              tone={overview.ai_rate_limited_7d > 0 ? "alarm" : "plain"}
              hint={
                <Link href="/admin/ai" className="underline">
                  ببین چه کسی
                </Link>
              }
            />
          </TileGrid>
        </TileGroup>

        <div className="grid gap-4 min-[860px]:grid-cols-2">
          <AdminCard title="ثبت‌نام روزانه" meta="۱۴ روز اخیر">
            <SignupsChart points={signupPoints} />
          </AdminCard>

          <AdminCard title="جاروب شبانهٔ مهمان‌ها" meta="هر شب ۰۳:۱۷">
            <KeyValues
              rows={[
                {
                  label: "آخرین اجرا",
                  value: overview.last_purge_at ? (
                    <span className="flex items-center gap-1.5">
                      {formatDateFa(overview.last_purge_at.slice(0, 10))}
                      <StatusPill
                        status={sweepStatus(overview.last_purge_result)}
                        label={sweepLabel(overview.last_purge_result)}
                      />
                    </span>
                  ) : (
                    <span className="text-ink-muted">هنوز اجرا نشده</span>
                  ),
                },
                {
                  label: "پیدا / پاک",
                  value: overview.last_purge_result
                    ? `${faNumber(Number(overview.last_purge_result.found ?? 0))} / ${faNumber(Number(overview.last_purge_result.purged ?? 0))}`
                    : "—",
                },
                {
                  label: "مهمان کهنهٔ فعلی",
                  value: (
                    <Link href="/admin/guests" className="text-action underline">
                      {faNumber(overview.guests_stale)}
                    </Link>
                  ),
                },
                {
                  label: "سقف نگه‌داری",
                  value: `${faNumber(settings.guest_retention_days)} روز`,
                },
              ]}
            />
            {!settings.ai_enabled && (
              <p className="mt-3 rounded-control border border-guess-border bg-guess-tint px-3 py-2 text-caption font-medium text-guess-text">
                پردازش هوشمند خاموش است. کاربران به فرم هدایت می‌شوند.
              </p>
            )}
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  );
}

function megabytes(bytes: number): string {
  if (bytes === 0) return "خالی";
  const mb = bytes / (1024 * 1024);
  return mb < 1024
    ? `${faNumber(Math.round(mb * 10) / 10)} مگابایت`
    : `${faNumber(Math.round((mb / 1024) * 10) / 10)} گیگابایت`;
}

/** The sweep's own verdict, read off the jsonb the route wrote. */
function sweepStatus(result: Record<string, unknown> | null): string {
  if (!result) return "failed";
  return Number(result.failed ?? 0) > 0 ? "failed" : "ok";
}

function sweepLabel(result: Record<string, unknown> | null): string {
  if (!result) return "نیمه‌کاره";
  const failed = Number(result.failed ?? 0);
  return failed > 0 ? `${faNumber(failed)} نرفت` : "موفق";
}
