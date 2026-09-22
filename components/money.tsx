import { formatMoney, type CurrencyCode, type Minor, type FormatOptions } from "@/lib/money";
import { cn } from "@/lib/utils";

type MoneySize = "hero" | "kpi" | "row" | "inherit";

type MoneyProps = FormatOptions & {
  minor: Minor;
  currency: CurrencyCode;
  size?: MoneySize;
  /** Colour by sign. Only for values where the sign is the message. */
  tone?: "auto" | "none";
  className?: string;
};

const SIZE_CLASS: Record<MoneySize, string> = {
  /**
   * One of the two places Estedad is allowed on a screen: the single figure
   * that answers the page's question. Clamped rather than fixed, because a
   * five-figure balance overflows 375px otherwise, and tracked in slightly —
   * at this size Vazirmatn's default figure spacing reads loose.
   */
  hero: "font-display font-extrabold text-[clamp(2rem,12vw,2.75rem)] leading-[1.05] tracking-[-0.02em]",
  kpi: "text-figure-md font-semibold",
  row: "text-[14px] font-semibold",
  inherit: "",
};

/**
 * The only way money is rendered. Direction-isolated so the currency symbol
 * keeps its place inside Persian text, and tabular so columns line up.
 */
export function Money({
  minor,
  currency,
  size = "inherit",
  tone = "none",
  signed,
  omitSymbol,
  className,
}: MoneyProps) {
  const text = formatMoney(minor, currency, { signed, omitSymbol });

  return (
    <span
      dir="ltr"
      className={cn(
        "tabular-nums [unicode-bidi:isolate]",
        SIZE_CLASS[size],
        tone === "auto" && (minor < 0 ? "text-negative" : "text-positive"),
        className,
      )}
    >
      {text}
    </span>
  );
}
