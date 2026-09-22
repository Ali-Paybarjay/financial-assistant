import { cn } from "@/lib/utils";

/**
 * The sheet every signed-in page is written on.
 *
 * The design's one structural rule is «یک ورق، نه دسته‌ای از کارت» — a page is
 * a single sheet, not a stack of bordered boxes floating on grey. Sections are
 * told apart by space and by their headings; a rule appears only between rows
 * that are genuinely adjacent. That is what keeps a goal, a chart and a list
 * of accounts from all reading as equally important, which is what happens
 * when each of them is wrapped in the same border.
 *
 * On a phone the sheet is full-bleed, because a 375px screen has no margin to
 * spare. From 960px it becomes a centred column that lifts off the paper
 * ground, so the ground is what the browser chrome touches, not the content.
 */
export function PageSheet({
  width = "narrow",
  className,
  children,
}: {
  /** "narrow" for a single reading column; "wide" for pages with a desktop grid. */
  width?: "narrow" | "wide";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full flex-1 bg-surface",
        "min-[960px]:my-6 min-[960px]:flex-none min-[960px]:rounded-card min-[960px]:shadow-lift",
        width === "narrow" ? "max-w-[560px]" : "max-w-[560px] min-[960px]:max-w-[1120px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A page's name and the one action it offers.
 *
 * The heading is always in the accessibility tree, even where the design has
 * no room to draw it — a screen with no h1 is a screen nobody can navigate to
 * by heading.
 */
export function PageHeader({
  title,
  /** Hide the title visually but keep it announced. For screens whose own
   *  content already says where you are, like the dashboard's balance. */
  visuallyHidden = false,
  children,
  className,
}: {
  title: string;
  visuallyHidden?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h1
        className={cn(
          "text-title font-semibold text-ink",
          visuallyHidden && "sr-only min-[960px]:not-sr-only",
        )}
      >
        {title}
      </h1>
      {children}
    </div>
  );
}

/**
 * A titled block on the sheet. No border, no background, no shadow: it is not
 * an object, it is a part of the page.
 */
export function Section({
  title,
  /** A link or control that belongs to this section's heading, e.g. «همه». */
  action,
  headingLevel: Heading = "h2",
  className,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  headingLevel?: "h2" | "h3";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col", className)}>
      {(title || action) && (
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          {title && (
            <Heading className="text-section font-semibold text-ink">{title}</Heading>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * A list of adjacent rows. Rules go *between* siblings and never around the
 * set — the heading above and the space below are what say where it ends.
 */
export function Rows({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col [&>*+*]:border-t [&>*+*]:border-hairline", className)}>
      {children}
    </div>
  );
}

/**
 * An inset well: the tinted ground showing through the sheet. For things that
 * are genuinely set into the page rather than written on it — a segmented
 * control, an empty state, a note the page is making about itself.
 */
export function Well({
  tone = "paper",
  className,
  children,
}: {
  tone?: "paper" | "guess" | "action";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-well px-3.5 py-3",
        tone === "paper" && "bg-paper",
        tone === "guess" && "bg-guess-tint",
        tone === "action" && "bg-action-tint",
        className,
      )}
    >
      {children}
    </div>
  );
}
