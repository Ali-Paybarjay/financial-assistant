"use client";

import * as React from "react";
import { currencySymbol, normalizeDigits, type CurrencyCode } from "@/lib/money";
import { cn } from "@/lib/utils";

type AmountInputProps = Omit<React.ComponentProps<"input">, "type" | "size"> & {
  currency: CurrencyCode;
  /** "hero" is the amount field in the entry form; "row" is everywhere else. */
  size?: "hero" | "row";
};

/**
 * inputmode="decimal" rather than type="number": a number input on mobile
 * rejects the Persian digits users actually type, and silently drops a value
 * the browser considers malformed instead of showing an error.
 */
export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  function AmountInput({ currency, size = "row", className, onChange, ...props }, ref) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-control border bg-surface px-3 transition-colors focus-within:border-lapis focus-within:ring-2 focus-within:ring-lapis/20",
          size === "hero" ? "h-[52px] border-lapis" : "h-12 border-hairline-strong",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "font-semibold text-ink-muted",
            size === "hero" ? "text-[22px]" : "text-[15px]",
          )}
        >
          {currencySymbol(currency)}
        </span>
        <input
          ref={ref}
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          className={cn(
            "w-full bg-transparent text-start tabular-nums outline-none placeholder:text-ink-faint",
            size === "hero" ? "text-[22px] font-semibold" : "text-[16px]",
            className,
          )}
          onChange={(event) => {
            // Normalise as the user types so what lands in form state is
            // already what lib/money can parse.
            event.target.value = normalizeDigits(event.target.value);
            onChange?.(event);
          }}
          {...props}
        />
      </div>
    );
  },
);
