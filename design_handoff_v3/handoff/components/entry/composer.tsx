"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUp,
  Camera,
  ChatTeardropText,
  Gear,
  SquaresFour,
  Target,
} from "@phosphor-icons/react/dist/ssr";
import { WORKSPACE_NAV } from "@/components/app-shell/nav-items";
import { quickParse } from "@/lib/entry/quick-parse";
import { cn } from "@/lib/utils";

/**
 * The composer: the app's one entry point, pinned to the bottom of every
 * signed-in page, with the tab bar living inside it.
 *
 * It replaces the floating «ثبت هزینه» button and the four-tab modal behind
 * it. Recording an expense was two taps and then a choice of tab before the
 * user could type; here the field is already there and the choice is made by
 * what they do — type, dictate with their own keyboard mic, or photograph.
 *
 * There is deliberately no in-app voice recorder: the keyboard has one, it
 * costs nothing, and it behaves the same on both platforms.
 *
 * Height is 120px (42 field + tab row + safe area). Every scrolling page must
 * reserve it — see AppShell's pb-[120px].
 */
export function Composer({
  /** Opens the confirm sheet with the model's reading of `text`. */
  onSubmitText,
  /** Pre-filled manual form, for a line the model does not need to read. */
  onLocalEntry,
  /** Opens the camera / file picker, then the confirm sheet. */
  onPickReceipt,
  placeholder = "چه خریدی؟ بنویس یا دیکته کن",
}: {
  onSubmitText: (text: string) => void;
  onLocalEntry: (draft: ReturnType<typeof quickParse>) => void;
  onPickReceipt: () => void;
  placeholder?: string;
}) {
  const pathname = usePathname();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const ready = value.trim().length > 0;

  function submit() {
    const text = value.trim();
    if (!text) return;
    // The gate that keeps the model out of the cheap cases: a line with no
    // number in it cannot be an expense, and «قهوه ۵.۷۵» is a regex away from
    // being parsed here for free. Only what is left reaches the API.
    const local = quickParse(text);
    if (local.handled) onLocalEntry(local);
    else onSubmitText(text);
    setValue("");
    inputRef.current?.blur();
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface px-3.5 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] min-[960px]:hidden">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex items-center gap-2"
      >
        <button
          type="button"
          onClick={onPickReceipt}
          aria-label="عکس فاکتور"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-paper text-ink-muted transition-colors hover:text-action"
        >
          <Camera size={20} />
        </button>

        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          enterKeyHint="send"
          autoComplete="off"
          aria-label="ثبت خرج"
          className="h-11 min-w-0 flex-1 rounded-full border border-hairline-strong bg-surface px-4 text-[14px] text-ink outline-none placeholder:text-ink-faint focus-visible:border-action"
        />

        <button
          type="submit"
          disabled={!ready}
          aria-label="ثبت"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
            ready
              ? "bg-action text-surface active:bg-action-pressed"
              : "bg-paper text-ink-faint",
          )}
        >
          <ArrowUp size={19} weight="fill" />
        </button>
      </form>

      <nav aria-label="ناوبری اصلی" className="mt-2 flex justify-between px-1.5">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-11 flex-col items-center gap-0.5 py-0.5",
                active ? "text-action" : "text-ink-muted",
              )}
            >
              <Icon size={19} weight={active ? "fill" : "regular"} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * Four, and «تراکنش‌ها» is not one of them: the list has two better doors —
 * the search field at the top of the board, and any envelope you tap. A fifth
 * tab would shrink all five below a comfortable target.
 *
 * Kept here rather than in nav-items.ts because WORKSPACE_NAV still describes
 * the sidebar, which does list every page.
 */
const TABS = [
  { href: "/dashboard", label: "پاکت‌ها", icon: SquaresFour },
  { href: "/stream", label: "جریان", icon: ChatTeardropText },
  { href: "/goals", label: "هدف‌ها", icon: Target },
  { href: "/settings", label: "تنظیمات", icon: Gear },
] as const satisfies readonly { href: string; label: string; icon: unknown }[];

/** Every tab above must be a page the personal workspace actually owns. */
const PERSONAL_ROUTES = new Set(
  WORKSPACE_NAV.personal.primary
    .concat(WORKSPACE_NAV.personal.desktopOnly)
    .map((item) => item.href),
);

if (process.env.NODE_ENV !== "production") {
  for (const tab of TABS) {
    if (tab.href !== "/stream" && !PERSONAL_ROUTES.has(tab.href)) {
      console.warn(`Composer tab ${tab.href} is not in WORKSPACE_NAV.personal`);
    }
  }
}
