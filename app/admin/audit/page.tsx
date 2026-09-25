import { requireAdmin } from "@/lib/admin/auth";
import { adminAuditLog } from "@/lib/admin/queries";
import { faNumber } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import { AdminPage, AdminCard } from "@/components/admin/page-shell";
import { DataTable, Pagination, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/status-pill";
import type { AdminAuditLogRow } from "@/lib/supabase/database.types";

/**
 * What was done, by whom, and to what.
 *
 * Insert-only in the database: there is no update policy and no delete policy on
 * this table, so a row cannot be edited or removed through the API by anyone —
 * including the admin who wrote it. That is the only property that makes a log
 * of one's own actions worth keeping.
 *
 * `actor_email` is stored on the row rather than joined, so the log still reads
 * after the account it names is gone. Which, given that one of the actions here
 * is «delete a user», is not hypothetical.
 */

/** Destructive actions are pilled in red; the rest are ordinary changes. */
const DESTRUCTIVE = new Set(["user.delete", "guests.purge", "category.delete"]);

const ACTION_LABELS: Record<string, string> = {
  "user.delete": "حذف کاربر",
  "guests.purge": "پاک‌سازی مهمان‌ها",
  "category.save": "ویرایش دسته",
  "category.create": "دستهٔ تازه",
  "category.delete": "حذف دسته",
  "settings.save": "تغییر تنظیمات",
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const result = await adminAuditLog(Number(params.page) || 1);

  const columns: readonly Column<AdminAuditLogRow>[] = [
    {
      key: "when",
      header: "زمان",
      cell: (row) => (
        <span className="whitespace-nowrap text-ink-muted">
          {formatDateFa(row.created_at.slice(0, 10))} · {row.created_at.slice(11, 16)}
        </span>
      ),
    },
    {
      key: "who",
      header: "ادمین",
      cell: (row) => (
        <span dir="ltr" className="block max-w-[22ch] truncate">
          {row.actor_email ?? row.actor_id?.slice(0, 8) ?? "—"}
        </span>
      ),
    },
    {
      key: "action",
      header: "اقدام",
      cell: (row) => (
        <StatusPill
          status={row.action}
          label={ACTION_LABELS[row.action] ?? row.action}
          tone={DESTRUCTIVE.has(row.action) ? "bad" : "accent"}
        />
      ),
    },
    {
      key: "target",
      header: "روی",
      cell: (row) =>
        row.target_id ? (
          <span dir="ltr" className="text-ink-muted">
            {row.target_id.length > 12 ? row.target_id.slice(0, 8) : row.target_id}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "detail",
      header: "جزئیات",
      cell: (row) => {
        if (!row.detail) return <span className="text-ink-faint">—</span>;
        const json = JSON.stringify(row.detail);
        return (
          <span
            dir="ltr"
            title={json}
            className="block max-w-[40ch] truncate font-mono text-caption text-ink-muted"
          >
            {json}
          </span>
        );
      },
    },
  ];

  return (
    <AdminPage
      title="گزارش اقدام‌ها"
      subtitle={`${faNumber(result.total)} اقدام · فقط افزودنی، نه ویرایش و نه حذف`}
    >
      <AdminCard>
        <DataTable
          columns={columns}
          rows={result.rows}
          rowKey={(row) => row.id}
          empty="هنوز هیچ اقدامی ثبت نشده."
          minWidth={760}
        />
        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          href={(page) => (page > 1 ? `/admin/audit?page=${page}` : "/admin/audit")}
          unit="اقدام"
        />
      </AdminCard>
    </AdminPage>
  );
}
