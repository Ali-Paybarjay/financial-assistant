"use client";

import Link from "next/link";
import { ArrowsLeftRight } from "@phosphor-icons/react/dist/ssr";
import { WORKSPACE_ICON } from "./nav-items";
import { HUB_PATH, WORKSPACES, type WorkspaceId } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

/**
 * Where you are, and the way to the other side.
 *
 * Both shells show this — the sidebar at the top, the phone as a strip above
 * the page — because a workspace you cannot see you are in is just a page
 * that lost some of its navigation. It is a link to the hub rather than a
 * toggle straight into the other workspace: the hub carries each side's
 * headline number, so switching is also how you check on the other one.
 */
export function WorkspaceSwitch({
  workspace,
  className,
}: {
  workspace: WorkspaceId;
  className?: string;
}) {
  const meta = WORKSPACES[workspace];
  const Glyph = WORKSPACE_ICON[workspace];

  return (
    <Link
      href={HUB_PATH}
      className={cn(
        "flex items-center gap-2 rounded-control border border-hairline bg-paper px-2.5 py-2 text-ink transition-colors hover:border-hairline-strong hover:bg-action-tint",
        className,
      )}
    >
      <Glyph size={18} className="shrink-0 text-action" />
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
        {meta.title}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-caption text-ink-muted">
        تعویض
        <ArrowsLeftRight size={14} />
      </span>
    </Link>
  );
}
