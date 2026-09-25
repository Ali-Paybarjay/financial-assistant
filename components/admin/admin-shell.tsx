"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowArcRight } from "@phosphor-icons/react/dist/ssr";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { SignOutButton } from "@/components/sign-out";
import { cn } from "@/lib/utils";

/**
 * The chrome around the panel, and deliberately not <AppShell>.
 *
 * It shares that component's visual grammar — the 232px sticky column, the
 * `border-s border-hairline bg-surface` edge, the action-tint active link — and
 * none of its behaviour. It has no composer, because this panel writes nothing
 * to anybody's ledger and a bar that recorded the *operator's* groceries while
 * they read somebody's failed import would be the worst kind of surprise. It
 * has no workspace switch, because `/admin` is not a third workspace:
 * `workspaceForPath` returns null for it, which is what keeps <AppShell> from
 * drawing chrome here at all.
 *
 * A client component for one reason, the same reason <AppShell> is: the active
 * link depends on the path, and a server layout is not told the path.
 *
 * <SignOutButton> reads `useIsGuest()`, whose context defaults to false with no
 * provider — correct here, since a guest can never be an admin.
 */
export function AdminShell({
  name,
  email,
  children,
}: {
  name: string;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Exact match for the overview, prefix for the rest: «/admin» is a prefix of
  // every page in here, so a startsWith would light it up on all of them.
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh bg-paper">
      <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-s border-hairline bg-surface p-4 min-[960px]:flex">
        <Brand className="mb-3.5 px-2" />

        <nav aria-label="ناوبری پنل مدیریت" className="flex flex-col gap-0.5">
          {ADMIN_NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2.5 rounded-control px-2.5 text-[14px] transition-colors",
                  active
                    ? "bg-action-tint font-medium text-action"
                    : "text-ink-muted hover:bg-action-tint hover:text-action",
                )}
              >
                <Icon size={20} weight={active ? "fill" : "regular"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2.5 border-t border-hairline px-2.5 pt-3.5">
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-medium text-ink">{name}</span>
            {email && (
              <span dir="ltr" className="truncate text-caption text-ink-muted">
                {email}
              </span>
            )}
          </span>
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-caption text-ink-muted hover:text-action"
            >
              <ArrowArcRight size={14} />
              برگشت به اپ
            </Link>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The phone's version of the sidebar: a sticky header, then the same
            nav as a strip that scrolls. Eight destinations will not fit in a
            tab bar — five across 375px is already under the touch target the
            design commits to — and this panel is read on a desktop far more
            often than the app is, so the phone case wants to stay usable
            rather than to be optimised for. */}
        <div className="sticky top-0 z-20 border-b border-hairline bg-surface/95 backdrop-blur min-[960px]:hidden">
          <div className="flex items-center gap-2 px-4 py-2">
            <Brand className="min-w-0 flex-1" />
            <SignOutButton />
          </div>
          <nav
            aria-label="ناوبری پنل مدیریت"
            className="flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {ADMIN_NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1.5 text-caption transition-colors",
                    active
                      ? "border-action-tint-edge bg-action-tint font-semibold text-action"
                      : "border-hairline text-ink-muted",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span aria-hidden className="size-[9px] shrink-0 rounded-full bg-action" />
      <span className="font-display text-[17px] font-bold text-ink">دستیار مالی</span>
      <span className="rounded-md bg-action-tint px-1.5 py-px text-micro font-semibold text-action">
        مدیریت
      </span>
    </div>
  );
}
