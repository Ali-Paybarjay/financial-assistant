"use client";

import { cn } from "@/lib/utils";

type OptionCardProps = {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  children: React.ReactNode;
};

/** 56px minimum, radio ring on the reading-start side. */
export function OptionCard({
  name,
  value,
  checked,
  onSelect,
  children,
}: OptionCardProps) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors",
        checked
          ? "border-[1.5px] border-action bg-action-tint font-medium text-ink"
          : "border-hairline bg-surface text-ink hover:border-hairline-strong",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          checked ? "border-action" : "border-hairline-strong",
        )}
      >
        {checked && <span className="size-2.5 rounded-full bg-action" />}
      </span>
      <span className="text-body">{children}</span>
    </label>
  );
}
