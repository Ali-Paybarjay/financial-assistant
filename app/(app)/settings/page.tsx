import Link from "next/link";
import {
  ArrowsClockwise,
  CaretLeft,
  Coins,
  SquaresFour,
  UserCircle,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
import { requireViewer } from "@/lib/auth";
import { COUNTRIES, CURRENCY_LABELS, RISK_LABELS } from "@/lib/onboarding/config";
import { CURRENCIES } from "@/lib/money";
import { SignOutButton } from "./sign-out-button";

/** M9 adds editing, category management and account deletion. This is the
 *  navigation surface the tab bar needs, plus signing out. */
export default async function SettingsPage() {
  const viewer = await requireViewer();
  const { profile } = viewer;

  const country = COUNTRIES.find((entry) => entry.code === profile.country_code);
  const currencyLabel = CURRENCIES.includes(viewer.currency)
    ? CURRENCY_LABELS[viewer.currency]
    : viewer.currency;

  const subtitle = [
    country?.name,
    viewer.currency,
    profile.risk_label ? RISK_LABELS[profile.risk_label] : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-4">
      <h1 className="mb-4 text-title font-semibold text-ink">تنظیمات</h1>

      <div className="flex items-center gap-3 rounded-card border border-hairline bg-surface p-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-lapis-tint text-[18px] font-semibold text-lapis">
          {(profile.full_name ?? "؟").trim().charAt(0)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[17px] font-semibold text-ink">
            {profile.full_name ?? "حساب من"}
          </span>
          <span className="truncate text-caption text-ink-muted">{subtitle}</span>
        </span>
      </div>

      <h2 className="mb-1.5 mt-5 text-caption font-semibold text-ink-muted">پول</h2>
      <div className="overflow-hidden rounded-card border border-hairline bg-surface">
        <SettingsLink href="/income" icon={<Wallet size={20} />} label="منابع درآمد" />
        <SettingsLink
          href="/income?tab=recurring"
          icon={<ArrowsClockwise size={20} />}
          label="هزینه‌های ثابت"
        />
        <SettingsLink
          href="/goals"
          icon={<SquaresFour size={20} />}
          label="هدف‌ها"
        />
        <SettingsLink
          href="/settings"
          icon={<Coins size={20} />}
          label="ارز پایه"
          value={currencyLabel}
        />
      </div>

      <h2 className="mb-1.5 mt-5 text-caption font-semibold text-ink-muted">حساب</h2>
      <div className="overflow-hidden rounded-card border border-hairline bg-surface">
        <div className="flex h-14 items-center gap-3 px-4 text-ink-muted">
          <UserCircle size={20} className="text-lapis" />
          <span className="flex-1 text-[14px] text-ink">ایمیل</span>
          <span dir="ltr" className="truncate text-caption">
            {viewer.email}
          </span>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}

function SettingsLink({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-14 items-center gap-3 border-b border-hairline px-4 last:border-b-0 hover:bg-paper"
    >
      <span className="text-lapis">{icon}</span>
      <span className="flex-1 text-[14px] text-ink">{label}</span>
      {value && <span className="text-caption text-ink-muted">{value}</span>}
      <CaretLeft size={16} className="text-ink-faint" />
    </Link>
  );
}
