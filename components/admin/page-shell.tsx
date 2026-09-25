/**
 * The header every admin page opens with, and the column it sits in.
 *
 * A server component in its own module rather than a helper inside
 * admin-shell.tsx: it has no interactivity, and exporting it from a
 * "use client" file would ship a layout wrapper to the browser for nothing.
 *
 * Here rather than repeated eight times, so the title's size and the
 * subtitle's tone stay one decision. The subtitle is where a page says what it
 * will *not* show — «هیچ ردیف دفتری اینجا نیست» — which is worth saying on the
 * page rather than only in a migration comment.
 */
export function AdminPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pt-5 pb-12 min-[960px]:p-7">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <h1 className="font-display text-title font-bold text-ink min-[960px]:text-question">
          {title}
        </h1>
        {subtitle && <p className="text-caption text-ink-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** A titled box. The panel's one container, so nothing else invents another. */
export function AdminCard({
  title,
  meta,
  children,
}: {
  title?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-4">
      {(title || meta) && (
        <div className="mb-3 flex items-baseline justify-between gap-2.5">
          {title && <h2 className="text-section font-semibold text-ink">{title}</h2>}
          {meta && <span className="text-micro text-ink-muted">{meta}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label/value rows, hairline-separated. For «what this account is». */
export function KeyValues({
  rows,
}: {
  rows: readonly { label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-well bg-hairline min-[560px]:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex justify-between gap-2.5 bg-surface px-3 py-2.5"
        >
          <dt className="text-caption text-ink-muted">{row.label}</dt>
          <dd className="text-label font-medium text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
