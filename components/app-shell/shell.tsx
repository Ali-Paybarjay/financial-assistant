"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { hasTabBar } from "./tab-bar";
import { WorkspaceSwitch } from "./workspace-switch";
import { Composer } from "@/components/entry/composer";
import { GuestBanner } from "@/components/guest/guest-banner";
import { workspaceForPath } from "@/lib/workspaces";
import type { CurrencyCode } from "@/lib/money";
import type { EnvelopeRow } from "@/lib/envelopes";
import type { AccountRow, CategoryRow, GoalRow } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * The chrome around every signed-in page, and the one thing that decides how
 * much of it there is.
 *
 * It is a client component because the answer depends on the url, and a
 * server layout is not told the url. The alternative — a segment layout per
 * workspace — would mean two copies of this file that have to stay identical,
 * and a hub page that has to opt out of both.
 *
 * On the hub itself there is no nav at all: it is the page you go to in order
 * to choose, and a nav for one of the choices would be answering for you.
 */
export function AppShell({
  name,
  subtitle,
  entry,
  children,
}: {
  name: string;
  subtitle: string;
  /**
   * What the composer needs to record a purchase. Read once in the layout
   * rather than per page, because the bar is on every page — that is the
   * whole point of it replacing a button that was only on two of them.
   */
  entry: {
    currency: CurrencyCode;
    categories: CategoryRow[];
    accounts: AccountRow[];
    goals: GoalRow[];
    envelopes: EnvelopeRow[];
    defaultAccountId: string | null;
    today: string;
  };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const workspace = workspaceForPath(pathname);

  return (
    <div className="flex min-h-dvh bg-paper">
      {workspace && <Sidebar workspace={workspace} name={name} subtitle={subtitle} />}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Beside <main> rather than above the whole row: the sidebar is a
            sticky full-height column, and a banner spanning both would push
            it down the page. */}
        <GuestBanner />

        {/* The phone's version of the sidebar's header. Sticky, because
            «کجا هستم» is a question that comes back halfway down a list. */}
        {workspace && (
          <div className="sticky top-0 z-20 border-b border-hairline bg-surface/95 px-4 py-2 backdrop-blur min-[960px]:hidden">
            <WorkspaceSwitch workspace={workspace} />
          </div>
        )}

        {/* One composer, not one per breakpoint. Rendering it twice and
            hiding one would put two elements with id="composer-text" on the
            page, which makes the label ambiguous and the field unfocusable
            by id. It sits here, where the desktop wants it — above the
            board — and its own `fixed` lifts it to the bottom of the screen
            on a phone, where there is nothing underneath it to cover. */}
        {workspace && (
          <div className="min-[960px]:mx-auto min-[960px]:w-full min-[960px]:max-w-[1120px] min-[960px]:px-7 min-[960px]:pt-6">
            <Composer workspace={workspace} {...entry} />
          </div>
        )}

        {/* 120px clears the composer — a 42px field, the four tabs, and the
            device's own bottom inset. It used to be pb-20 for a tab bar
            alone. It disappears with the bar, both at 960px and in a
            workspace that has no bar to clear. */}
        <main
          className={cn(
            "min-w-0 flex-1",
            workspace && hasTabBar(workspace)
              ? "pb-[120px] min-[960px]:pb-0"
              : workspace && "pb-[64px] min-[960px]:pb-0",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
