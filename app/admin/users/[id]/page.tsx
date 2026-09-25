import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import {
  adminImports,
  adminUserDetail,
  adminUserMedia,
  adminUserUsage,
} from "@/lib/admin/queries";
import { featureLabel } from "@/lib/admin/status";
import { faNumber } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import { Money } from "@/components/money";
import { AdminPage, AdminCard, KeyValues } from "@/components/admin/page-shell";
import { KpiTile, TileGrid } from "@/components/admin/kpi-tile";
import { StatusPill } from "@/components/admin/status-pill";
import { DataTable, type Column } from "@/components/admin/data-table";
import { DeleteUserSheet } from "./delete-user-sheet";
import { COUNTRIES } from "@/lib/onboarding/config";

/**
 * One account, in the terms an operator answering an email needs.
 *
 * Identity, setup, and how much of the product this person has touched — as
 * counts. There is no list of their transactions here and there is no way to
 * get one: the panel has no read policy on that table, so this page could not
 * show a purchase even if it wanted to. The closest it comes is «last
 * transaction on», which answers «are they still using it» without naming a
 * single amount.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UsageRow = Awaited<ReturnType<typeof adminUserUsage>>[number];
type MediaRow = Awaited<ReturnType<typeof adminUserMedia>>[number];

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  // A malformed id would reach Postgres as a cast error and surface as «this
  // page did not come up». Same guard /dong/[id] uses.
  if (!UUID.test(id)) notFound();

  const user = await adminUserDetail(id);
  if (!user) notFound();

  const [usage, media, imports] = await Promise.all([
    adminUserUsage(id),
    adminUserMedia(id),
    adminImports("all", 1, id),
  ]);

  const country = COUNTRIES.find((entry) => entry.code === user.country_code);
  const expected = user.email ?? user.id.slice(0, 8);

  const usageColumns: readonly Column<UsageRow>[] = [
    { key: "when", header: "زمان", cell: (row) => (
      <span className="text-ink-muted">{formatDateFa(row.created_at.slice(0, 10))}</span>
    ) },
    { key: "feature", header: "مسیر", cell: (row) => featureLabel(row.feature) },
    { key: "status", header: "وضعیت", cell: (row) => <StatusPill status={row.status} /> },
    {
      key: "tokens",
      header: "توکن",
      numeric: true,
      cell: (row) => faNumber((row.input_tokens ?? 0) + (row.output_tokens ?? 0)),
    },
    {
      key: "cost",
      header: "هزینه",
      numeric: true,
      cell: (row) =>
        row.cost_cents ? (
          <Money minor={row.cost_cents} currency="USD" />
        ) : (
          <span className="text-ink-faint">زیر ۱¢</span>
        ),
    },
    {
      key: "latency",
      header: "تأخیر",
      numeric: true,
      cell: (row) =>
        row.latency_ms === null
          ? "—"
          : `${faNumber(Math.round(row.latency_ms / 100) / 10)} ث`,
    },
  ];

  const mediaColumns: readonly Column<MediaRow>[] = [
    { key: "when", header: "زمان", cell: (row) => (
      <span className="text-ink-muted">{formatDateFa(row.created_at.slice(0, 10))}</span>
    ) },
    { key: "kind", header: "نوع", cell: (row) => (
      <span dir="ltr" className="text-ink-muted">{row.mime_type}</span>
    ) },
    {
      key: "size",
      header: "حجم",
      numeric: true,
      cell: (row) => `${faNumber(Math.round(row.size_bytes / 1024))} ک‌ب`,
    },
    { key: "status", header: "وضعیت", cell: (row) => <StatusPill status={row.status} /> },
    {
      key: "error",
      header: "خطا",
      cell: (row) =>
        row.error_message ? (
          <span title={row.error_message} className="block max-w-[28ch] truncate text-negative">
            {row.error_message}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

  return (
    <AdminPage
      title={user.full_name?.trim() || "بی‌نام"}
      subtitle={
        <Link href="/admin/users" className="text-action underline">
          برگشت به فهرست کاربران
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        <AdminCard title="هویت">
          <KeyValues
            rows={[
              {
                label: "ایمیل",
                value: user.email ? (
                  <span dir="ltr">{user.email}</span>
                ) : (
                  <span className="text-ink-muted">ندارد — مهمان</span>
                ),
              },
              { label: "ورود با", value: <StatusPill status={user.provider} /> },
              {
                label: "نقش",
                value: user.is_admin ? (
                  <StatusPill status="review" label="مدیر" tone="accent" />
                ) : (
                  <span className="text-ink-muted">کاربر عادی</span>
                ),
              },
              { label: "شناسه", value: <span dir="ltr">{user.id.slice(0, 8)}</span> },
              {
                label: "ثبت‌نام",
                value: formatDateFa(user.created_at.slice(0, 10)),
              },
              {
                label: "آخرین ورود",
                value: user.last_sign_in_at
                  ? formatDateFa(user.last_sign_in_at.slice(0, 10))
                  : "هرگز",
              },
            ]}
          />
        </AdminCard>

        <AdminCard title="تنظیمات">
          <KeyValues
            rows={[
              {
                label: "کشور · ارز",
                value:
                  [country?.name, user.base_currency].filter(Boolean).join(" · ") || "—",
              },
              {
                label: "منطقهٔ زمانی",
                value: <span dir="ltr">{user.timezone ?? "—"}</span>,
              },
              {
                label: "آنبوردینگ",
                value: user.onboarding_completed_at
                  ? `تمام — ${formatDateFa(user.onboarding_completed_at.slice(0, 10))}`
                  : `گام ${faNumber(user.onboarding_step)}، نیمه‌کاره`,
              },
              {
                label: "بخش پیش‌فرض",
                value:
                  user.default_workspace === "dong"
                    ? "دنگ و دونگ"
                    : user.default_workspace === "personal"
                      ? "حسابداری شخصی"
                      : "می‌پرسد",
              },
              { label: "تم", value: themeLabel(user.theme) },
              {
                label: "آخرین تراکنش",
                value: user.last_transaction_on
                  ? formatDateFa(user.last_transaction_on)
                  : "هیچ",
              },
            ]}
          />
        </AdminCard>

        <section className="flex flex-col gap-1.5">
          <h2 className="text-micro tracking-wide text-ink-faint">
            حجم — شمارش، نه مبلغ
          </h2>
          <TileGrid>
            <KpiTile label="تراکنش" value={faNumber(user.transactions_count)} />
            <KpiTile label="حساب بانکی" value={faNumber(user.accounts_count)} />
            <KpiTile label="هدف" value={faNumber(user.goals_count)} />
            <KpiTile label="دورهٔ دنگ" value={faNumber(user.dong_groups_count)} />
            <KpiTile label="صورت‌حساب" value={faNumber(user.imports_count)} />
            <KpiTile
              label="فایل"
              value={faNumber(user.media_count)}
              hint={`${faNumber(Math.round(user.media_bytes / (1024 * 1024)))} مگابایت`}
            />
            <KpiTile label="فراخوانی AI ۳۰ روز" value={faNumber(user.ai_calls_30d)} />
            <KpiTile
              label="هزینهٔ AI ۳۰ روز"
              value={
                <span className="rule-guess">
                  <Money minor={user.ai_cost_cents_30d} currency="USD" />
                </span>
              }
              hint="تقریبی"
            />
          </TileGrid>
        </section>

        <AdminCard title="آخرین فراخوانی‌های مدل" meta="۲۰ مورد اخیر">
          <DataTable
            columns={usageColumns}
            rows={usage}
            rowKey={(row) => row.id}
            empty="این حساب هیچ‌وقت از پردازش هوشمند استفاده نکرده."
            minWidth={560}
          />
        </AdminCard>

        <AdminCard title="صورت‌حساب‌های بانکی" meta={`${faNumber(imports.total)} مورد`}>
          <DataTable
            columns={[
              {
                key: "when",
                header: "زمان",
                cell: (row) => (
                  <span className="text-ink-muted">
                    {formatDateFa(row.created_at.slice(0, 10))}
                  </span>
                ),
              },
              {
                key: "status",
                header: "وضعیت",
                cell: (row) =>
                  row.is_stuck ? (
                    <StatusPill status="stuck" />
                  ) : (
                    <StatusPill status={row.status} />
                  ),
              },
              {
                key: "lines",
                header: "خط",
                numeric: true,
                cell: (row) => faNumber(row.line_count),
              },
              {
                key: "imported",
                header: "ثبت‌شده",
                numeric: true,
                cell: (row) => faNumber(row.imported_count),
              },
              {
                key: "error",
                header: "خطا",
                cell: (row) =>
                  row.error_message ? (
                    <span
                      title={row.error_message}
                      className="block max-w-[28ch] truncate text-negative"
                    >
                      {row.error_message}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  ),
              },
            ]}
            rows={imports.rows}
            rowKey={(row) => row.id}
            empty="هیچ صورت‌حسابی آپلود نکرده."
            minWidth={520}
          />
        </AdminCard>

        <AdminCard title="فایل‌های آپلودی" meta="متادیتا — خودِ فایل نه">
          <DataTable
            columns={mediaColumns}
            rows={media}
            rowKey={(row) => row.id}
            empty="فایلی آپلود نکرده."
            minWidth={520}
          />
        </AdminCard>

        <DeleteUserSheet
          userId={user.id}
          email={user.email}
          expected={expected}
          counts={{
            transactions: user.transactions_count,
            media: user.media_count,
            accounts: user.accounts_count,
            goals: user.goals_count,
          }}
        />
      </div>
    </AdminPage>
  );
}

function themeLabel(theme: string | null): string {
  if (theme === "light") return "روشن";
  if (theme === "dark") return "تیره";
  return "سیستم";
}
