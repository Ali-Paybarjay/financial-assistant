"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TabBar, hasTabBar } from "./tab-bar";
import { WorkspaceSwitch } from "./workspace-switch";
import { GuestBanner } from "@/components/guest/guest-banner";
import { workspaceForPath } from "@/lib/workspaces";
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
  children,
}: {
  name: string;
  subtitle: string;
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

        {/* A flex column, so a short page's sheet still stretches to the
            bottom of the viewport on a phone, where it is full-bleed — a sheet
            that stops halfway reads as a page that failed to finish loading.
            pb-20 clears the fixed tab bar, and disappears with it: at 960px,
            and in a workspace that has no bar to clear. */}
        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            // On a phone the page's sheet is full-bleed, so the strip this
            // padding reserves for the tab bar would otherwise show the paper
            // ground through the bottom of the sheet. The hub is excluded on
            // purpose: it has no workspace and no sheet — there the paper IS
            // the page, and the two choices are what sit on it.
            workspace && "bg-surface min-[960px]:bg-transparent",
            workspace && hasTabBar(workspace) && "pb-20 min-[960px]:pb-0",
          )}
        >
          {children}
        </main>
      </div>

      {workspace && <TabBar workspace={workspace} />}
    </div>
  );
}
