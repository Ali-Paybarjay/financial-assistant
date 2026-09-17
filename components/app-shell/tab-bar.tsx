"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV } from "./nav-items";
import { cn } from "@/lib/utils";

/** Mobile only; from 960px the sidebar replaces it. */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ناوبری اصلی"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] min-[960px]:hidden"
    >
      <ul className="mx-auto flex max-w-[480px]">
        {PRIMARY_NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1",
                  active ? "text-lapis" : "text-ink-muted",
                )}
              >
                <Icon size={22} weight={active ? "fill" : "regular"} />
                <span className="text-micro font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
