import { requireAdmin } from "@/lib/admin/auth";
import { adminCronRuns, adminGuests } from "@/lib/admin/queries";
import { appSettings } from "@/lib/settings-server";
import { faNumber } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import { AdminPage, AdminCard } from "@/components/admin/page-shell";
import { KpiTile, TileGrid } from "@/components/admin/kpi-tile";
import { StatusPill } from "@/components/admin/status-pill";
import { DataTable, type Column } from "@/components/admin/data-table";
import { PurgeNowButton } from "./purge-now";
import type { AdminGuestRow, CronRunRow } from "@/lib/supabase/database.types";

/**
 * Where a promise is kept.
 *
 * The login screen tells a guest their data is temporary. A guest who signs out
 * makes that true themselves; one who closes the tab never does, so a nightly
 * sweep does it for them — and whether that sweep ran has, until now, been
 * knowable only from Vercel's scheduler log.
 *
 * Migration 0018 is why this page exists at all: the first version of the sweep
 * could never have worked and would have failed silently every night at 03:17.
 * A run with a `started_at` and no `finished_at` is exactly that failure, and it
 * is visible here as «نیمه‌کاره» rather than as nothing.
 */
export default async function AdminGuestsPage() {
  await requireAdmin();

  const settings = await appSettings();
  const [guests, runs] = await Promise.all([
    adminGuests(settings.guest_retention_days),
    adminCronRuns("purge-guests", 10),
  ]);

  const stale = guests.filter((guest) => guest.is_stale);
  const last = runs[0];

  const guestColumns: readonly Column<AdminGuestRow>[] = [
    {
      key: "id",
      header: "شناسه",
      cell: (row) => <span dir="ltr">{row.id.slice(0, 8)}</span>,
    },
    {
      key: "idle",
      header: "بی‌حرکت",
      numeric: true,
      cell: (row) => `${faNumber(row.idle_days)} روز`,
    },
    {
      key: "seen",
      header: "آخرین ورود",
      cell: (row) => (
        <span className="text-ink-muted">
          {row.last_sign_in_at
            ? formatDateFa(row.last_sign_in_at.slice(0, 10))
            : formatDateFa(row.created_at.slice(0, 10))}
        </span>
      ),
    },
    {
      key: "stale",
      header: "وضعیت",
      cell: (row) =>
        row.is_stale ? (
          <StatusPill status="failed" label="کهنه" />
        ) : (
          <StatusPill status="ok" label="فعال" />
        ),
    },
    {
      key: "transactions",
      header: "تراکنش",
      numeric: true,
      cell: (row) => faNumber(row.transactions_count),
    },
    {
      key: "media",
      header: "فایل",
      numeric: true,
      cell: (row) => faNumber(row.media_count),
    },
  ];

  const runColumns: readonly Column<CronRunRow>[] = [
    {
      key: "when",
      header: "زمان",
      cell: (row) => (
        <span className="text-ink-muted">
          {formatDateFa(row.started_at.slice(0, 10))} · {row.started_at.slice(11, 16)}
        </span>
      ),
    },
    {
      key: "by",
      header: "آغازگر",
      cell: (row) =>
        row.triggered_by === "admin" ? (
          <StatusPill status="review" label="ادمین" tone="accent" />
        ) : (
          <StatusPill status="discarded" label="زمان‌بند" />
        ),
    },
    {
      key: "found",
      header: "پیدا",
      numeric: true,
      cell: (row) => faNumber(Number(row.result?.found ?? 0)),
    },
    {
      key: "purged",
      header: "پاک",
      numeric: true,
      cell: (row) => faNumber(Number(row.result?.purged ?? 0)),
    },
    {
      key: "failed",
      header: "نرفت",
      numeric: true,
      cell: (row) => {
        const failed = Number(row.result?.failed ?? 0);
        return failed > 0 ? (
          <span className="font-semibold text-negative">{faNumber(failed)}</span>
        ) : (
          faNumber(0)
        );
      },
    },
    {
      key: "status",
      header: "نتیجه",
      cell: (row) => <StatusPill status={runStatus(row)} label={runLabel(row)} />,
    },
  ];

  return (
    <AdminPage
      title="مهمان‌ها"
      subtitle={`دادهٔ مهمان بعد از ${faNumber(settings.guest_retention_days)} روز بی‌حرکتی پاک می‌شود`}
    >
      <div className="flex flex-col gap-4">
        <TileGrid>
          <KpiTile label="مهمان فعلی" value={faNumber(guests.length)} />
          <KpiTile
            label="کهنه"
            value={faNumber(stale.length)}
            tone={stale.length > 0 ? "alarm" : "plain"}
            hint={stale.length > 0 ? "امشب می‌روند" : "چیزی در صف نیست"}
          />
          <KpiTile
            label="جاروب آخر"
            value={
              last?.result ? `${faNumber(Number(last.result.purged ?? 0))} پاک شد` : "—"
            }
            hint={last ? formatDateFa(last.started_at.slice(0, 10)) : "هنوز اجرا نشده"}
          />
          <KpiTile
            label="سقف نگه‌داری"
            value={`${faNumber(settings.guest_retention_days)} روز`}
            hint="از تنظیمات عوض می‌شود"
          />
        </TileGrid>

        <PurgeNowButton
          stale={stale.length}
          retentionDays={settings.guest_retention_days}
        />

        <AdminCard title="جاروب‌های اخیر" meta="Vercel cron · هر شب ۰۳:۱۷">
          <DataTable
            columns={runColumns}
            rows={runs}
            rowKey={(row) => row.id}
            empty="هنوز هیچ جاروبی ثبت نشده — اولین اجرا امشب است."
            minWidth={560}
          />
        </AdminCard>

        <AdminCard
          title="مهمان‌ها"
          meta="بی‌حرکت‌ترین‌ها اول · حداکثر ۱۰۰ مورد"
        >
          <DataTable
            columns={guestColumns}
            rows={guests}
            rowKey={(row) => row.id}
            empty="هیچ حساب مهمانی نیست."
            minWidth={560}
          />
        </AdminCard>
      </div>
    </AdminPage>
  );
}

/**
 * A run with no `finished_at` is the one that crashed part-way, which is a
 * different thing from a run that reported failures — and the more serious one,
 * because nothing in it can be trusted to have happened.
 */
function runStatus(run: CronRunRow): string {
  if (run.error) return "failed";
  if (!run.finished_at) return "parsing";
  return Number(run.result?.failed ?? 0) > 0 ? "failed" : "ok";
}

function runLabel(run: CronRunRow): string {
  if (run.error) return "خطا";
  if (!run.finished_at) return "نیمه‌کاره";
  return Number(run.result?.failed ?? 0) > 0 ? "ناقص" : "موفق";
}
