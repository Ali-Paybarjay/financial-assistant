"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserCircle } from "@phosphor-icons/react/dist/ssr";
import { DESKTOP_ONLY_NAV, PRIMARY_NAV } from "./nav-items";
import { cn } from "@/lib/utils";

/**
 * From 960px only. It sits before <main> in a `direction: rtl` flex row with no
 * `order` override — in RTL flex the lowest order goes to the right, so any
 * order property would invert the intent.
 */
export function Sidebar({ name, subtitle }: { name: string; subtitle: string }) {
  const pathname = usePathname();
  const items = [...PRIMARY_NAV.slice(0, 3), ...DESKTOP_ONLY_NAV, PRIMARY_NAV[3]];

  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-s border-hairline bg-surface p-4 min-[960px]:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="size-[9px] rounded-full bg-lapis" />
        <span className="font-display text-[17px] font-bold text-ink">دستیار مالی</span>
      </div>

      <nav aria-label="ناوبری اصلی" className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = pathname.startsWith(item.href.split("?")[0]);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-2.5 rounded-control px-2.5 text-[14px] transition-colors",
                active
                  ? "bg-lapis-tint font-medium text-lapis"
                  : "text-ink-muted hover:bg-lapis-tint hover:text-lapis",
              )}
            >
              <Icon size={20} weight={active ? "fill" : "regular"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/settings"
        className="mt-auto flex items-center gap-2.5 border-t border-hairline px-2.5 pt-4 text-ink-muted hover:text-lapis"
      >
        <UserCircle size={24} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-medium text-ink">{name}</span>
          <span className="truncate text-caption">{subtitle}</span>
        </span>
      </Link>
    </aside>
  );
}
