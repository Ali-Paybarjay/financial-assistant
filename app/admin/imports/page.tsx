import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { adminImports } from "@/lib/admin/queries";
import { faNumber } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import { AdminPage, AdminCard } from "@/components/admin/page-shell";
import { DataTable, Pagination, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/status-pill";
import type { AdminImportRow } from "@/lib/supabase/database.types";

/**
 * The most expensive path in the app, and the one that breaks.
 *
 * A bank statement is a 300-second route against a PDF from a bank nobody has
 * seen before. When it fails, the user is told something vague and the reason —
 * which the importer does write down, in `error_message` — has until now been
 * readable by nobody at all.
 *
 * «گیرکرده» is the filter that earns this page. An import that dies mid-parse
 * stays in `parsing` forever: the user watches a spinner that will never
 * resolve, and the row counts as healthy in every count of failures. Open for
 * more than an hour is well past the route's own ceiling, so it is not waiting
 * for anything.
 *
 * No closing balance anywhere on this page. It is the one column on that table
 * that is the user's money.
 */

const FILTERS = [
  { value: "all", label: "همه" },
  { value: "open", label: "باز" },
  { value: "stuck", label: "گیرکرده" },
  { value: "failed", label: "شکست‌خورده" },
  { value: "applied", label: "اعمال‌شده" },
  { value: "discarded", label: "رهاشده" },
];

export default async function AdminImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const status = params.status ?? "all";
  const result = await adminImports(status, Number(params.page) || 1);

  const href = (page: number) => {
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);
    if (page > 1) query.set("page", String(page));
    const search = query.toString();
    return search ? `/admin/imports?${search}` : "/admin/imports";
  };

  const columns: readonly Column<AdminImportRow>[] = [
    {
      key: "who",
      header: "کاربر",
      cell: (row) => (
        <Link href={`/admin/users/${row.user_id}`} className="text-action hover:underline">
          <span dir="ltr">{row.email ?? `مهمان ${row.user_id.slice(0, 8)}`}</span>
        </Link>
      ),
    },
    {
      key: "status",
      header: "وضعیت",
      // A stuck row's own status is «parsing», which reads as healthy. The
      // panel's verdict wins here, and says so in one word.
      cell: (row) =>
        row.is_stuck ? <StatusPill status="stuck" /> : <StatusPill status={row.status} />,
    },
    {
      key: "currency",
      header: "ارز",
      cell: (row) => (
        <span dir="ltr" className="text-ink-muted">
          {row.source_currency} → {row.target_currency}
        </span>
      ),
    },
    {
      key: "files",
      header: "فایل",
      numeric: true,
      cell: (row) => faNumber(row.file_count),
    },
    {
      key: "lines",
      header: "خط",
      numeric: true,
      cell: (row) => faNumber(row.line_count),
    },
    {
      key: "split",
      header: "تطبیق / جدید / ثبت",
      numeric: true,
      cell: (row) =>
        row.line_count === 0 ? (
          <span className="text-ink-faint">—</span>
        ) : (
          `${faNumber(row.matched_count)} / ${faNumber(row.new_count)} / ${faNumber(row.imported_count)}`
        ),
    },
    {
      key: "error",
      header: "پیام خطا",
      cell: (row) => {
        if (row.error_message) {
          return (
            <span
              title={row.error_message}
              className="block max-w-[32ch] truncate text-negative"
            >
              {row.error_message}
            </span>
          );
        }
        if (row.is_stuck) {
          return (
            <span className="text-ink-muted">
              در «{row.status === "parsing" ? "پارس" : "آپلود"}» مانده
            </span>
          );
        }
        return <span className="text-ink-faint">—</span>;
      },
    },
    {
      key: "when",
      header: "زمان",
      cell: (row) => (
        <span className="text-ink-muted">{formatDateFa(row.created_at.slice(0, 10))}</span>
      ),
    },
  ];

  const stuck = result.rows.filter((row) => row.is_stuck).length;

  return (
    <AdminPage
      title="صورت‌حساب‌ها"
      subtitle="متادیتا و خطا · بدون مانده و بدون ردیف صورت‌حساب"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => {
            const active = status === filter.value;
            return (
              <Link
                key={filter.value}
                href={
                  filter.value === "all"
                    ? "/admin/imports"
                    : `/admin/imports?status=${filter.value}`
                }
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-full border border-action-tint-edge bg-action-tint px-3 py-1.5 text-caption font-semibold text-action"
                    : "rounded-full border border-hairline px-3 py-1.5 text-caption text-ink-muted hover:border-hairline-strong hover:text-action"
                }
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        {stuck > 0 && status !== "stuck" && (
          <p className="rounded-control border border-negative/25 bg-negative-tint px-3 py-2.5 text-caption font-medium text-negative">
            {faNumber(stuck)} ایمپورت در این صفحه گیر کرده — کاربرش هنوز منتظر است.{" "}
            <Link href="/admin/imports?status=stuck" className="underline">
              فقط همان‌ها
            </Link>
          </p>
        )}

        <AdminCard>
          <DataTable
            columns={columns}
            rows={result.rows}
            rowKey={(row) => row.id}
            empty="با این فیلتر ایمپورتی نیست."
            minWidth={880}
          />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            href={href}
            unit="ایمپورت"
          />
        </AdminCard>
      </div>
    </AdminPage>
  );
}
