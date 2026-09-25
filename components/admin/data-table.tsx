import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { faNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The panel's table.
 *
 * A real <table>, not a grid of divs: these are rows of tabular data with
 * headers, and a screen reader that can say «column 3 of 7, AI calls» is worth
 * more here than any layout convenience. A server component, so cells can hold
 * a <Link>, a <Money> or a <StatusPill> without any of it reaching the client.
 *
 * Horizontal scroll is the deliberate answer to a phone. A seven-column table
 * squeezed into 375px is unreadable in every direction; one that scrolls
 * sideways inside its own box keeps the columns legible and the page still
 * enough. The wrapper is pulled out to the page's gutter so a row can start at
 * the screen edge rather than in the middle of a margin.
 */

export type Column<Row> = {
  key: string;
  header: string;
  /** Right-aligned and tabular. Numbers in a column have to line up. */
  numeric?: boolean;
  cell: (row: Row) => React.ReactNode;
};

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  empty = "چیزی نیست.",
  minWidth = 640,
}: {
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  empty?: string;
  /** Below this the columns crush; above it the table scrolls. */
  minWidth?: number;
}) {
  if (rows.length === 0) {
    return <p className="px-1 py-6 text-caption text-ink-muted">{empty}</p>;
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 min-[960px]:mx-0 min-[960px]:px-0">
      <table className="w-full border-collapse" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "pb-2 px-2.5 text-caption font-medium whitespace-nowrap text-ink-muted",
                  column.numeric ? "text-end" : "text-start",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition-colors hover:bg-action-tint">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "border-t border-hairline p-2.5 align-middle text-label",
                    column.numeric ? "text-end tabular-nums" : "text-start",
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Prev/next as links, so a page is a URL.
 *
 * Buttons would mean state, and state would mean the operator cannot send
 * somebody «page 4 of the failed imports». `href` is built by the caller
 * because only it knows which of its query parameters to keep.
 */
export function Pagination({
  page,
  pageCount,
  total,
  href,
  unit,
}: {
  page: number;
  pageCount: number;
  total: number;
  href: (page: number) => string;
  /** «حساب», «ایمپورت» — what is being counted. */
  unit: string;
}) {
  if (pageCount <= 1) {
    return (
      <p className="pt-3 text-caption text-ink-muted">
        {faNumber(total)} {unit}
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <p className="text-caption text-ink-muted">
        صفحهٔ {faNumber(page)} از {faNumber(pageCount)} · {faNumber(total)} {unit}
      </p>
      <div className="flex gap-1.5">
        <PageLink href={href(page - 1)} disabled={page <= 1} label="قبلی">
          {/* Previous is «back», which in an RTL page points right. */}
          <CaretRight size={14} />
        </PageLink>
        <PageLink href={href(page + 1)} disabled={page >= pageCount} label="بعدی">
          <CaretLeft size={14} />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const classes =
    "flex h-9 items-center gap-1 rounded-control border border-hairline px-3 text-caption text-ink-muted";

  if (disabled) {
    return (
      <span aria-disabled className={cn(classes, "opacity-45")}>
        {children}
        {label}
      </span>
    );
  }

  return (
    <Link href={href} className={cn(classes, "hover:border-hairline-strong hover:text-action")}>
      {children}
      {label}
    </Link>
  );
}
