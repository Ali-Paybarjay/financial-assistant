"use client";

import { useState } from "react";
import { PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { faNumber } from "@/lib/format";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/status-pill";
import { AdminCard } from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { CategorySheet, type EditableCategory } from "./category-sheet";

/**
 * The table and the sheet, together, because one of them holds the other's
 * state. The page above stays a server component and does the reading; this only
 * decides which row is open.
 */
export function CategoriesView({ rows }: { rows: EditableCategory[] }) {
  const [editing, setEditing] = useState<EditableCategory | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: readonly Column<EditableCategory>[] = [
    { key: "name", header: "نام", cell: (row) => <b className="font-semibold">{row.name_fa}</b> },
    {
      key: "slug",
      header: "slug",
      cell: (row) => (
        <span dir="ltr" className="text-ink-muted">
          {row.slug}
        </span>
      ),
    },
    {
      key: "kind",
      header: "نوع",
      cell: (row) => (row.kind === "income" ? "درآمد" : "هزینه"),
    },
    {
      key: "cost",
      header: "ماهیت",
      cell: (row) =>
        row.cost_kind === "fixed" ? (
          <StatusPill status="discarded" label="ثابت" />
        ) : (
          <StatusPill status="review" label="متغیر" tone="accent" />
        ),
    },
    {
      key: "order",
      header: "ترتیب",
      numeric: true,
      cell: (row) => faNumber(row.sort_order),
    },
    {
      key: "usage",
      header: "استفاده",
      numeric: true,
      cell: (row) =>
        row.usageTotal === 0 ? (
          <span className="text-ink-faint">۰</span>
        ) : (
          faNumber(row.usageTotal)
        ),
    },
    {
      key: "edit",
      header: "",
      cell: (row) => (
        <span className="flex items-center gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(row)}>
            <PencilSimple size={14} />
            ویرایش
          </Button>
          {row.protected && <StatusPill status="uploading" label="محافظت‌شده" />}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button type="button" variant="outline" onClick={() => setCreating(true)}>
          دستهٔ تازه
        </Button>
      </div>

      <AdminCard>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty="دستهٔ سیستمی‌ای نیست، که خودش یک باگ است."
          minWidth={760}
        />
      </AdminCard>

      {editing && <CategorySheet category={editing} onDone={() => setEditing(null)} />}
      {creating && <CategorySheet category={null} onDone={() => setCreating(false)} />}
    </>
  );
}
