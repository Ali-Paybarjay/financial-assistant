"use client";

import { useTransition } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import type { Theme } from "@/lib/theme";
import { saveTheme } from "@/app/(app)/settings/actions";
import { cn } from "@/lib/utils";

type Option = {
  value: Theme;
  label: string;
  hint: string;
};

const OPTIONS: Option[] = [
  { value: "light", label: "روشن", hint: "همان دفتر و مدادِ اصلی" },
  { value: "dark", label: "تیره", hint: "برای ثبت خرج در شب" },
  { value: "system", label: "مثل سیستم", hint: "پیش‌فرض — تا دست نزنی همین است" },
];

/**
 * Three cards, each showing the theme it names rather than describing it.
 *
 * A switch would have been smaller, but a switch cannot say «system», and
 * «system» is the right default: the phone already knows whether it is night.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [, startTransition] = useTransition();

  function choose(next: Theme) {
    // Paints immediately; the profile write follows and is allowed to be slow.
    setTheme(next);
    startTransition(() => {
      void saveTheme(next);
    });
  }

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="sr-only">تم</legend>
      {OPTIONS.map((option) => {
        const checked = theme === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-well border p-3 transition-colors",
              checked
                ? "border-[1.5px] border-action bg-action-tint"
                : "border-hairline bg-surface hover:border-hairline-strong",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={checked}
              onChange={() => choose(option.value)}
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

            <ThemePreview theme={option.value} />

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-[15px] text-ink",
                  checked ? "font-semibold" : "font-medium",
                )}
              >
                {option.label}
              </span>
              <span className="mt-0.5 block text-micro text-ink-faint">{option.hint}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/**
 * A 52×64 sketch of the theme: header bar, two rows, one action. Hard-coded
 * hexes on purpose — this swatch has to show the theme you are NOT in, so it
 * cannot read the live variables.
 */
function ThemePreview({ theme }: { theme: Theme }) {
  if (theme === "system") {
    return (
      <span
        aria-hidden
        className="flex h-16 w-13 shrink-0 overflow-hidden rounded-lg border border-hairline"
        style={{ width: 52 }}
      >
        <span className="w-1/2" style={{ background: "#ffffff" }} />
        <span className="w-1/2" style={{ background: "#101120" }} />
      </span>
    );
  }

  const palette =
    theme === "dark"
      ? { bg: "#101120", edge: "#38346e", block: "#21223a", row: "#191a2b", action: "#a3a0e8" }
      : { bg: "#ffffff", edge: "#d7d5e0", block: "#191a2e", row: "#edecf2", action: "#302c73" };

  return (
    <span
      aria-hidden
      className="flex shrink-0 flex-col gap-1 rounded-lg border p-1.5"
      style={{ width: 52, height: 64, background: palette.bg, borderColor: palette.edge }}
    >
      <span className="h-3.5 rounded-[3px]" style={{ background: palette.block }} />
      <span className="h-1.5 rounded-[2px]" style={{ background: palette.row }} />
      <span className="h-1.5 rounded-[2px]" style={{ background: palette.row }} />
      <span className="mt-auto h-2 rounded-[2px]" style={{ background: palette.action }} />
    </span>
  );
}
