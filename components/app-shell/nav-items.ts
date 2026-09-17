import {
  ArrowsClockwise,
  Bank,
  CreditCard,
  Gear,
  House,
  ListDashes,
  Target,
  UsersThree,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
// The component type lives on the package root; the SSR entry only exports the
// icons themselves. Type-only, so nothing extra reaches the bundle.
import type { Icon } from "@phosphor-icons/react";

export type NavItem = {
  href: string;
  label: string;
  icon: Icon;
};

/** The four the design puts in the mobile tab bar. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "داشبورد", icon: House },
  { href: "/transactions", label: "تراکنش‌ها", icon: ListDashes },
  { href: "/goals", label: "هدف‌ها", icon: Target },
  { href: "/settings", label: "تنظیمات", icon: Gear },
];

/** Promoted into the sidebar from 960px; on mobile they live under Settings. */
export const DESKTOP_ONLY_NAV: NavItem[] = [
  { href: "/accounts", label: "حساب‌ها", icon: CreditCard },
  { href: "/income", label: "درآمد", icon: Wallet },
  { href: "/income?tab=recurring", label: "هزینه‌های ثابت", icon: ArrowsClockwise },
  { href: "/import", label: "صورت‌حساب بانکی", icon: Bank },
  { href: "/dong", label: "دنگ و دونگ", icon: UsersThree },
];
