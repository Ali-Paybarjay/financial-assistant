"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WORKSPACE_NAV } from "./nav-items";
import type { WorkspaceId } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

/** Mobile only; from 960px the sidebar replaces it. */
export function TabBar({ workspace }: { workspace: WorkspaceId }) {
  const pathname = usePathname();
  const items = WORKSPACE_NAV[workspace].primary;

  // A bar with one tab in it is a bar that does nothing: it cannot take you
  // anywhere you are not, and it eats 56px of a phone screen saying so.
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="ناوبری اصلی"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] min-[960px]:hidden"
    >
      <ul className="mx-auto flex max-w-[480px]">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1",
                  active ? "text-action" : "text-ink-muted",
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

/** Whether the bar above will render anything, for the shell's bottom padding. */
export function hasTabBar(workspace: WorkspaceId): boolean {
  return WORKSPACE_NAV[workspace].primary.length >= 2;
}
