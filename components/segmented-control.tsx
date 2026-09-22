"use client";

import { cn } from "@/lib/utils";

type Segment<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
};

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 rounded-xl bg-paper p-1"
    >
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(segment.value)}
            className={cn(
              "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-control text-[13px] font-medium transition-colors",
              active ? "bg-surface text-ink shadow-float" : "text-ink-muted",
            )}
          >
            {segment.icon}
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
