import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { adminAiLatency, adminAiTopUsers, adminAiUsageDaily } from "@/lib/admin/queries";
import { featureLabel } from "@/lib/admin/status";
import {
  byFeature,
  byModel,
  byStatus,
  failureRate,
  seconds,
  usageByDay,
  usageTotals,
} from "@/lib/admin/reports";
import { appSettings } from "@/lib/settings-server";
import { getViewer } from "@/lib/auth";
import { addDays, daysBetween, formatDateFa, todayInTimeZone } from "@/lib/date";
import { faNumber } from "@/lib/format";
import { Money } from "@/components/money";
import { AdminPage, AdminCard } from "@/components/admin/page-shell";
import { KpiTile, TileGrid } from "@/components/admin/kpi-tile";
import { StatusPill } from "@/components/admin/status-pill";
import { DataTable } from "@/components/admin/data-table";
import { UsageChart, UsageLegend } from "@/components/admin/usage-chart";
import type { AdminAiLatencyRow, AdminAiTopUserRow } from "@/lib/supabase/database.types";

/**
 * Where the money goes.
 *
 * This is the page the panel was built for. Three things have to be visible at
 * once and were previously visible nowhere: what the model cost, what share of
 * calls failed, and who is hitting the ceiling — because a farm of guest
 * accounts burning three calls each looks like nothing in any single one of
 * those numbers and obvious in all three together.
 *
 * One query. `admin_ai_usage_daily` returns (day, feature, status, model)
 * buckets and lib/admin/reports.ts folds them into the four views below, so the
 * definition of «failed» cannot differ between two tables on one screen.
 */

const RANGES = [
  { days: 1, label: "امروز" },
  { days: 7, label: "۷ روز" },
  { days: 30, label: "۳۰ روز" },
  { days: 90, label: "۹۰ روز" },
];

export default async function AdminAiPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; days?: string }>;
}) {
  await requireAdmin();

  const viewer = await getViewer();
  const timeZone = viewer?.timeZone ?? "UTC";
  const settings = await appSettings();
  const params = await searchParams;

  const today = todayInTimeZone(timeZone);
  const span = Number(params.days) || 30;
  const to = params.to ?? today;
  const from = params.from ?? addDays(to, -(span - 1));

  // Guard the axis rather than the query: a hand-edited `from` a decade back
  // would ask Postgres for one cheap group-by and then try to draw 3,650 bars.
  const length = Math.min(Math.max(daysBetween(from, to) + 1, 1), 120);
  const days = Array.from({ length }, (_, index) => addDays(from, index));

  const [rows, latency, top] = await Promise.all([
    adminAiUsageDaily(from, to, timeZone),
    adminAiLatency(from, to, timeZone),
    adminAiTopUsers(from, to, timeZone, 10),
  ]);

  const totals = usageTotals(rows);
  const rate = failureRate(totals);
  const points = usageByDay(rows, days);

  const latencyColumns = [
    { key: "feature", header: "مسیر", cell: (row: AdminAiLatencyRow) => featureLabel(row.feature) },
    {
      key: "p50",
      header: "میانه",
      numeric: true,
      cell: (row: AdminAiLatencyRow) =>
        row.p50 === null ? "—" : `${faNumber(seconds(Number(row.p50)) ?? 0)} ث`,
    },
    {
      key: "p95",
      header: "صدک ۹۵",
      numeric: true,
      cell: (row: AdminAiLatencyRow) =>
        row.p95 === null ? "—" : `${faNumber(seconds(Number(row.p95)) ?? 0)} ث`,
    },
    {
      key: "calls",
      header: "تعداد",
      numeric: true,
      cell: (row: AdminAiLatencyRow) => faNumber(row.calls),
    },
  ];

  const topColumns = [
    {
      key: "who",
      header: "کاربر",
      cell: (row: AdminAiTopUserRow) => (
        <Link href={`/admin/users/${row.user_id}`} className="text-action hover:underline">
          <span dir="ltr">{row.email ?? `مهمان ${row.user_id.slice(0, 8)}`}</span>
        </Link>
      ),
    },
    {
      key: "calls",
      header: "فراخوانی",
      numeric: true,
      cell: (row: AdminAiTopUserRow) => faNumber(row.calls),
    },
    {
      key: "cost",
      header: "هزینه",
      numeric: true,
      cell: (row: AdminAiTopUserRow) => <Money minor={row.cost_cents} currency="USD" />,
    },
    {
      key: "rejected",
      header: "سقف",
      numeric: true,
      cell: (row: AdminAiTopUserRow) =>
        row.rejected > 0 ? (
          <span className="font-semibold text-guess-text">{faNumber(row.rejected)}</span>
        ) : (
          faNumber(0)
        ),
    },
    {
      key: "failed",
      header: "خطا",
      numeric: true,
      cell: (row: AdminAiTopUserRow) =>
        row.failed > 0 ? (
          <span className="font-semibold text-negative">{faNumber(row.failed)}</span>
        ) : (
          faNumber(0)
        ),
    },
  ];

  const rangeHref = (days: number) => `/admin/ai?days=${days}`;

  return (
    <AdminPage
      title="هوش مصنوعی"
      subtitle={`${formatDateFa(from)} تا ${formatDateFa(to)} · به وقت تو`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((range) => {
            const active = span === range.days;
            return (
              <Link
                key={range.days}
                href={rangeHref(range.days)}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-full border border-action-tint-edge bg-action-tint px-3 py-1.5 text-caption font-semibold text-action"
                    : "rounded-full border border-hairline px-3 py-1.5 text-caption text-ink-muted hover:border-hairline-strong hover:text-action"
                }
              >
                {range.label}
              </Link>
            );
          })}
        </div>

        {!settings.ai_enabled && (
          <p className="rounded-control border border-guess-border bg-guess-tint px-3 py-2.5 text-caption font-medium text-guess-text">
            پردازش هوشمند الان خاموش است. عددهای زیر تاریخ‌اند، نه وضعیت امروز.{" "}
            <Link href="/admin/settings" className="underline">
              تنظیمات
            </Link>
          </p>
        )}

        <TileGrid>
          <KpiTile
            label="فراخوانی"
            value={faNumber(totals.calls)}
            hint={`${faNumber(totals.rejected)} پیش از خرج رد شد`}
          />
          <KpiTile
            label="هزینه"
            value={
              <span className="rule-guess">
                <Money minor={totals.costCents} currency="USD" />
              </span>
            }
            hint="تقریبی — زیر یک سنت ثبت نمی‌شود"
          />
          <KpiTile
            label="نرخ خطا"
            value={rate === null ? "—" : `${faNumber(rate)}٪`}
            tone={rate !== null && rate > 5 ? "alarm" : "plain"}
            hint={`${faNumber(totals.failed)} فراخوانی`}
          />
          <KpiTile
            label="توکن"
            value={faNumber(totals.inputTokens + totals.outputTokens)}
            hint={`${faNumber(totals.outputTokens)} خروجی`}
          />
        </TileGrid>

        <AdminCard title="فراخوانی روزانه" meta={<UsageLegend />}>
          <UsageChart points={points} />
          <p className="mt-1.5 text-micro text-ink-faint">
            زمان از چپ به راست می‌رود — محور SVG با جهت صفحه نمی‌چرخد.
          </p>
        </AdminCard>

        <div className="grid gap-4 min-[860px]:grid-cols-2">
          <AdminCard title="به تفکیک مسیر">
            <DataTable
              columns={[
                { key: "feature", header: "مسیر", cell: (row) => featureLabel(row.key) },
                {
                  key: "calls",
                  header: "فراخوانی",
                  numeric: true,
                  cell: (row) => faNumber(row.totals.calls),
                },
                {
                  key: "cost",
                  header: "هزینه",
                  numeric: true,
                  cell: (row) => <Money minor={row.totals.costCents} currency="USD" />,
                },
                {
                  key: "limit",
                  header: "سقف روزانه",
                  numeric: true,
                  cell: (row) =>
                    faNumber(
                      settings.ai_daily_limits[
                        row.key as keyof typeof settings.ai_daily_limits
                      ] ?? 0,
                    ),
                },
              ]}
              rows={byFeature(rows)}
              rowKey={(row) => row.key}
              empty="در این بازه فراخوانی‌ای نبوده."
              minWidth={420}
            />
          </AdminCard>

          <AdminCard title="به تفکیک وضعیت">
            <DataTable
              columns={[
                { key: "status", header: "وضعیت", cell: (row) => <StatusPill status={row.key} /> },
                {
                  key: "calls",
                  header: "تعداد",
                  numeric: true,
                  cell: (row) => faNumber(row.totals.calls),
                },
                {
                  key: "share",
                  header: "سهم",
                  numeric: true,
                  cell: (row) =>
                    totals.calls === 0
                      ? "—"
                      : `${faNumber(Math.round((row.totals.calls / totals.calls) * 1000) / 10)}٪`,
                },
              ]}
              rows={byStatus(rows)}
              rowKey={(row) => row.key}
              empty="در این بازه فراخوانی‌ای نبوده."
              minWidth={360}
            />
          </AdminCard>
        </div>

        <div className="grid gap-4 min-[860px]:grid-cols-2">
          <AdminCard title="تأخیر" meta="فقط فراخوانی‌های سالم">
            <DataTable
              columns={latencyColumns}
              rows={latency}
              rowKey={(row) => row.feature}
              empty="فراخوانی سالمی در این بازه نبوده."
              minWidth={400}
            />
            <p className="mt-2 text-micro text-ink-faint">
              تایم‌اوت در این جدول نیست: تأخیرش بودجهٔ ماست، نه سرعت مدل.
            </p>
          </AdminCard>

          <AdminCard title="پرمصرف‌ترین‌ها" meta="۱۰ نفر اول">
            <DataTable
              columns={topColumns}
              rows={top}
              rowKey={(row) => row.user_id}
              empty="کسی در این بازه از مدل استفاده نکرده."
              minWidth={460}
            />
          </AdminCard>
        </div>

        <AdminCard title="به تفکیک مدل" meta="برای وقتی مدل عوض می‌شود">
          <DataTable
            columns={[
              {
                key: "model",
                header: "مدل",
                cell: (row) => <span dir="ltr">{row.key}</span>,
              },
              {
                key: "calls",
                header: "فراخوانی",
                numeric: true,
                cell: (row) => faNumber(row.totals.calls),
              },
              {
                key: "cost",
                header: "هزینه",
                numeric: true,
                cell: (row) => <Money minor={row.totals.costCents} currency="USD" />,
              },
              {
                key: "tokens",
                header: "توکن",
                numeric: true,
                cell: (row) =>
                  faNumber(row.totals.inputTokens + row.totals.outputTokens),
              },
            ]}
            rows={byModel(rows)}
            rowKey={(row) => row.key}
            empty="در این بازه فراخوانی‌ای نبوده."
            minWidth={460}
          />
        </AdminCard>
      </div>
    </AdminPage>
  );
}
