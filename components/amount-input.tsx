"use client";

import * as React from "react";
import {
  currencySymbol,
  normalizeDigits,
  symbolTrails,
  type CurrencyCode,
} from "@/lib/money";
import { cn } from "@/lib/utils";

type AmountInputProps = Omit<React.ComponentProps<"input">, "type" | "size"> & {
  currency: CurrencyCode;
  /** "hero" is the amount field in the entry form; "row" is everywhere else. */
  size?: "hero" | "row";
  /**
   * For the few amounts that may sit below zero — an account in debt, a
   * balance read off a statement. See the sign key below.
   */
  allowNegative?: boolean;
};

/** True when this text already carries a minus, in any of the shapes we accept. */
function readsNegative(value: string): boolean {
  return normalizeDigits(value).trim().startsWith("-");
}

/**
 * Write a value the way a keystroke would, so React hears about it.
 *
 * `input.value = next` is invisible to React: it keeps a tracker on the
 * element holding the last value it saw, a plain assignment goes through that
 * tracker and updates it, and React then reads the change as one it already
 * knows about and delivers no event — leaving a controlled field to snap back
 * on the next render and react-hook-form never told the amount moved. The
 * prototype's setter writes past the tracker, so the `input` event that
 * follows is the same path a real keypress takes.
 */
function typeValue(input: HTMLInputElement, next: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, next);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * inputmode="decimal" rather than type="number": a number input on mobile
 * rejects the Persian digits users actually type, and silently drops a value
 * the browser considers malformed instead of showing an error.
 *
 * That keypad has no minus key, on either phone OS — so an amount that is
 * allowed to be negative carries its own sign key rather than an instruction
 * to type a character the keyboard will not offer.
 */
export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  function AmountInput(
    { currency, size = "row", allowNegative = false, className, onChange, ...props },
    ref,
  ) {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [negative, setNegative] = React.useState(false);

    // What the key shows is read back off the element rather than kept in step
    // by hand, because the value arrives by two paths this component does not
    // own: react-hook-form writes a form reset straight to the DOM, and a
    // registered field re-renders nothing when it changes — the first cut of
    // this trusted a render to follow a keystroke, and the key stayed unpressed
    // with a minus sitting in the field. Hence both a mount-and-reset sweep and
    // a read on every change.
    React.useEffect(syncSign);

    function syncSign() {
      const isNegative = readsNegative(inputRef.current?.value ?? "");
      setNegative((previous) => (previous === isNegative ? previous : isNegative));
    }

    function attachRef(node: HTMLInputElement | null) {
      inputRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }

    function toggleSign() {
      const input = inputRef.current;
      if (!input) return;
      const current = normalizeDigits(input.value).trim();
      const next = current.startsWith("-") ? current.slice(1) : `-${current}`;
      typeValue(input, next);
      // The keypad stays up: the sign is usually pressed on the way to typing
      // the number, not after it. The caret is put back at the end by hand —
      // a value set from script leaves it wherever the browser decides, and
      // at position 0 the next digit would land in front of the minus.
      input.focus();
      input.setSelectionRange(next.length, next.length);
    }

    // "$" sits in front of the number; "تومان" is a word and reads as a unit
    // after it. The container is RTL, so trailing means first in source order.
    const symbol = (
      <span
        aria-hidden
        className={cn(
          "shrink-0 font-semibold text-ink-muted",
          size === "hero" ? "text-[22px]" : "text-[15px]",
          symbolTrails(currency) && (size === "hero" ? "text-[17px]" : "text-[13px]"),
        )}
      >
        {currencySymbol(currency)}
      </span>
    );

    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-control border bg-surface px-3 transition-colors focus-within:border-action focus-within:ring-2 focus-within:ring-action/20",
          size === "hero" ? "h-[52px] border-action" : "h-12 border-hairline-strong",
        )}
      >
        {allowNegative && (
          <button
            type="button"
            onClick={toggleSign}
            aria-pressed={negative}
            aria-label="منفی کردن مبلغ"
            className={cn(
              "flex shrink-0 items-center justify-center rounded-control border font-semibold leading-none transition-colors",
              size === "hero" ? "size-10 text-[20px]" : "size-9 text-[17px]",
              negative
                ? "border-negative/25 bg-negative-tint text-negative"
                : "border-hairline bg-paper text-ink-muted hover:text-ink",
            )}
          >
            −
          </button>
        )}
        {symbolTrails(currency) ? symbol : null}
        <input
          ref={attachRef}
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
            syncSign();
            onChange?.(event);
          }}
          {...props}
        />
        {symbolTrails(currency) ? null : symbol}
      </div>
    );
  },
);
