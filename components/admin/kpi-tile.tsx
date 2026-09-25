import { cn } from "@/lib/utils";

/**
 * One figure, its name, and one line of context.
 *
 * The same card grammar as <KpiCards> on the dashboard — `rounded-card
 * border-hairline bg-surface`, a micro label above the figure — so the panel
 * reads as the same product rather than as an admin tool bolted to the side of
 * one. It is a server component: cells routinely hold a <Money> or a <Link>.
 *
 * `alarm` is for a figure whose *existence* is the news — guests about to be
 * deleted, imports that failed — and it changes the card's ground rather than
 * just the text, because a red number among fifteen black ones is not seen.
 */
export function KpiTile({
  label,
  value,
  hint,
  tone = "plain",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** `alarm` draws the whole card in the negative tint. */
  tone?: "plain" | "alarm";
  /** `hint` in green when the news is good, red when it is not. */
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-card border px-2.5 py-3",
        tone === "alarm"
          ? "border-negative bg-negative-tint"
          : "border-hairline bg-surface",
        className,
      )}
    >
      <span className="text-micro text-ink-muted">{label}</span>
      <span className="text-figure-md font-semibold text-ink">{value}</span>
      {hint && <span className="text-micro text-ink-faint">{hint}</span>}
    </div>
  );
}

/** The grid the tiles sit in: two up on a phone, four across from 960px. */
export function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-3 min-[960px]:grid-cols-4">
      {children}
    </div>
  );
}

/**
 * The line above a group of tiles.
 *
 * Twenty tiles in one grid is a wall. Grouped under «کاربران», «دفتر» and «هوش
 * مصنوعی» the same twenty answer three questions instead of none.
 */
export function TileGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-micro tracking-wide text-ink-faint">{label}</h2>
      {children}
    </section>
  );
}
