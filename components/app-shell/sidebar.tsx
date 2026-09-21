"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserCircle } from "@phosphor-icons/react/dist/ssr";
import { sidebarItems } from "./nav-items";
import { WorkspaceSwitch } from "./workspace-switch";
import type { WorkspaceId } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

/**
 * From 960px only. It sits before <main> in a `direction: rtl` flex row with no
 * `order` override — in RTL flex the lowest order goes to the right, so any
 * order property would invert the intent.
 */
export function Sidebar({
  workspace,
  name,
  subtitle,
}: {
  workspace: WorkspaceId;
  name: string;
  subtitle: string;
}) {
  const pathname = usePathname();
  const items = sidebarItems(workspace);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-s border-hairline bg-surface p-4 min-[960px]:flex">
      <div className="mb-3 flex items-center gap-2 px-2">
        <span className="size-[9px] rounded-full bg-lapis" />
        <span className="font-display text-[17px] font-bold text-ink">دستیار مالی</span>
      </div>

      {/* Which half of the app this nav belongs to, said before the nav
          itself — otherwise a sidebar with one item in it reads as a bug. */}
      <WorkspaceSwitch workspace={workspace} className="mb-4" />

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

      {/* Only on the personal side. Settings is one of its pages, and a
          profile link that quietly moved the user out of the trip they were
          in would be the one thing this split is meant to stop. From «دنگ و
          دونگ» the way out is the switch above, which says where it goes. */}
      {workspace === "personal" && (
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
      )}
    </aside>
  );
}
