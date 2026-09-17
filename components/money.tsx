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
  // Clamped, not fixed at 40px: a five-figure balance overflows 375px otherwise.
  hero: "font-display font-extrabold text-[clamp(1.75rem,11vw,2.5rem)] leading-[1.1]",
  kpi: "text-[16px] font-semibold",
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
