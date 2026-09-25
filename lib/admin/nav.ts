import {
  Bank,
  Gear,
  ListMagnifyingGlass,
  Sparkle,
  SquaresFour,
  Tag,
  UserCircleDashed,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { NavItem } from "@/components/app-shell/nav-items";

/**
 * The panel's own nav.
 *
 * A module with no "use client", for the same reason nav-items.ts is one: a
 * map of components exported from a client module reaches a server component
 * as a client reference and renders «Element type is invalid».
 *
 * Nothing here is shared with WORKSPACE_NAV. The panel is not a third
 * workspace — `workspaceForPath("/admin")` returns null, so the app shell
 * draws no chrome for it at all, which is exactly right: an operator looking
 * at somebody's failed import is not «in» their accounting.
 */
export const ADMIN_NAV: readonly NavItem[] = [
  { href: "/admin", label: "نمای کلی", icon: SquaresFour },
  { href: "/admin/users", label: "کاربران", icon: UsersThree },
  { href: "/admin/ai", label: "هوش مصنوعی", icon: Sparkle },
  { href: "/admin/imports", label: "صورت‌حساب‌ها", icon: Bank },
  { href: "/admin/guests", label: "مهمان‌ها", icon: UserCircleDashed },
  { href: "/admin/categories", label: "دسته‌ها", icon: Tag },
  { href: "/admin/settings", label: "تنظیمات", icon: Gear },
  { href: "/admin/audit", label: "گزارش اقدام‌ها", icon: ListMagnifyingGlass },
];
