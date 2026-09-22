import * as React from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * A native <select>, not the Radix one. On a phone — where most of this app is
 * used — the OS picker is faster to operate than a rendered listbox, and it
 * cannot open on the wrong side in RTL.
 */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(function NativeSelect({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-12 w-full appearance-none rounded-control border border-hairline-strong bg-surface px-3 pe-9 text-[16px] text-ink outline-none transition-colors focus-visible:border-action focus-visible:ring-2 focus-visible:ring-action/20 disabled:opacity-45 aria-invalid:border-negative",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <CaretDown
        size={16}
        aria-hidden
        className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-faint"
      />
    </div>
  );
});
