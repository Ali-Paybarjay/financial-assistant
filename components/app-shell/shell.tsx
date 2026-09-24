"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { WorkspaceSwitch } from "./workspace-switch";
import { Composer } from "@/components/entry/composer";
import type { CaptureData } from "@/components/entry/capture-sheet";
import { SignOutButton } from "@/components/sign-out";
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
  entry: CaptureData;
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
          <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-hairline bg-surface/95 px-4 py-2 backdrop-blur min-[960px]:hidden">
            <WorkspaceSwitch workspace={workspace} className="min-w-0 flex-1" />
            {/* Reachable from every screen rather than only from settings. */}
            <SignOutButton />
          </div>
        )}

        {/* One composer, not one per breakpoint. Rendering it twice and
            hiding one would put two elements with id="composer-text" on the
            page, which makes the label ambiguous and the field unfocusable
            by id. It sits here, where the desktop wants it — above the
            board — and its own `fixed` lifts it to the bottom of the screen
            on a phone, where there is nothing underneath it to cover.

            Personal only, and that is rule 11 rather than a layout choice.
            This bar writes to the personal ledger, so on a trip page it
            would take «قهوه ۵» from someone looking at a shared expense list
            and quietly file it as their own spending — the exact
            cross-contamination the two workspaces exist to prevent. «دنگ و
            دونگ» records an expense through its own sheet, which knows who
            paid and how it splits; a free-text bar that knew neither would
            have to guess both. */}
        {workspace === "personal" && (
          <div className="min-[960px]:mx-auto min-[960px]:w-full min-[960px]:max-w-[1120px] min-[960px]:px-7 min-[960px]:pt-6">
            <Composer workspace={workspace} {...entry} />
          </div>
        )}

        {/* Clears the composer, which is 122px plus whatever the device
            reserves at its bottom edge: a 1px rule, 10px of padding, a 44px
            row — the touch targets, not the 42px field, set that height —
            10px more padding, and the 56px tab bar. It was pb-20 for a tab
            bar alone.

            The inset is carried through with calc rather than rounded into
            the constant, because it is 0 on most phones and 34px on the ones
            with a home indicator; a single number is either short on one or
            leaves dead space on the other. The 2px over 122 is slack, not
            arithmetic — the alternative is a list whose last row is two
            pixels under the bar, which is exactly the kind of thing no gate
            measures. tests/e2e/composer.spec.ts does.

            Only where the bar actually is: «دنگ و دونگ» has neither a
            composer nor a tab bar, so it has nothing to clear. */}
        <main
          className={cn(
            "min-w-0 flex-1",
            workspace === "personal" &&
              "pb-[calc(124px+env(safe-area-inset-bottom))] min-[960px]:pb-0",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
