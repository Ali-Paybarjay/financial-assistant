import * as React from "react";
import { cn } from "@/lib/utils";

/** 48px tall per the design system; 16px text so iOS Safari does not zoom on focus. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-control border border-hairline-strong bg-surface px-3 text-[16px] text-ink transition-colors outline-none placeholder:text-ink-faint focus-visible:border-lapis focus-visible:ring-2 focus-visible:ring-lapis/20 disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-negative aria-invalid:ring-2 aria-invalid:ring-negative/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
