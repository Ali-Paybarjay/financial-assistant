import {
  ArrowsClockwise,
  Bank,
  CreditCard,
  Gear,
  ListDashes,
  SquaresFour,
  Target,
  UsersThree,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
// The component type lives on the package root; the SSR entry only exports the
// icons themselves. Type-only, so nothing extra reaches the bundle.
import type { Icon } from "@phosphor-icons/react";
import type { WorkspaceId } from "@/lib/workspaces";

export type NavItem = {
  href: string;
  label: string;
  icon: Icon;
};

/**
 * One glyph per side of the app, wherever a workspace is named.
 *
 * Here rather than beside <WorkspaceSwitch>, which is a client component:
 * every export of a "use client" module reaches a server component as a
 * client reference, so a *map* of components read on the server comes back
 * undefined and React renders "Element type is invalid". The hub is a server
 * component and needs these, so they live in a module with no directive.
 */
export const WORKSPACE_ICON: Record<WorkspaceId, Icon> = {
  personal: Target,
  dong: UsersThree,
};

export type WorkspaceNav = {
  /** The mobile tab bar, and the top of the sidebar. */
  primary: NavItem[];
  /** Promoted into the sidebar from 960px; on mobile they live under Settings. */
  desktopOnly: NavItem[];
};

/**
 * One nav per workspace. Nothing of «دنگ و دونگ» appears while the user is in
 * their own accounting and nothing of their accounting appears while they are
 * in a trip — see lib/workspaces.ts for why the app is split in two at all.
 */
export const WORKSPACE_NAV: Record<WorkspaceId, WorkspaceNav> = {
  personal: {
    /**
     * «تراکنش‌ها» left this list when «جریان» arrived and came back when it
     * went. Four items, because five across 375px gives each one 75px —
     * under the touch target the design commits to.
     */
    primary: [
      { href: "/dashboard", label: "پاکت‌ها", icon: SquaresFour },
      { href: "/transactions", label: "تراکنش‌ها", icon: ListDashes },
      { href: "/goals", label: "هدف‌ها", icon: Target },
      { href: "/settings", label: "تنظیمات", icon: Gear },
    ],
    desktopOnly: [
      { href: "/accounts", label: "حساب‌ها", icon: CreditCard },
      { href: "/income", label: "درآمد", icon: Wallet },
      { href: "/income?tab=recurring", label: "هزینه‌های ثابت", icon: ArrowsClockwise },
      { href: "/import", label: "صورت‌حساب بانکی", icon: Bank },
    ],
  },
  /**
   * One page, so no tab bar: see TabBar, which renders nothing below two
   * items rather than putting a lone tab across the bottom of the phone. The
   * way out of here is the switch in the header, which is the only other
   * place a person in a trip wants to go.
   */
  dong: {
    primary: [{ href: "/dong", label: "دوره‌ها", icon: UsersThree }],
    desktopOnly: [],
  },
};

/**
 * The sidebar's order: everything above Settings, then the pages the phone
 * hides, then Settings at the bottom of the list — where it is looked for.
 */
export function sidebarItems(workspace: WorkspaceId): NavItem[] {
  const { primary, desktopOnly } = WORKSPACE_NAV[workspace];
  const last = primary[primary.length - 1];
  return [...primary.slice(0, -1), ...desktopOnly, ...(last ? [last] : [])];
}
