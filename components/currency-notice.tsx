import { CURRENCY_LABELS } from "@/lib/onboarding/config";
import { isCurrencyCode, type CurrencyCode } from "@/lib/money";

/**
 * Said once, above a figure that could not include everything.
 *
 * A total is only ever built in one currency, and this app has no exchange
 * rate — so an amount recorded in another one is left out rather than folded in
 * at 1:1. That exclusion has to be visible: a number that quietly omits half a
 * month is worse than no number, and the version of this app that summed them
 * together produced «۱۵٬۰۰۰ تومان» out of 100 CAD and 50 USD. F01.
 *
 * Renders nothing when there is nothing to say, so callers can place it
 * unconditionally.
 */
export function CurrencyNotice({
  currencies,
  className,
}: {
  currencies: readonly string[];
  className?: string;
}) {
  const named = currencies.filter(isCurrencyCode);
  if (named.length === 0) return null;

  return (
    <p
      className={
        className ??
        "rounded-control border border-guess-border bg-guess-tint px-3 py-2 text-caption font-medium text-guess-text"
      }
    >
      مبلغ‌هایی با {named.map(label).join("، ")} هم ثبت شده که در این عددها حساب
      نشده‌اند — این نسخه ارز را تبدیل نمی‌کند.
    </p>
  );
}

function label(code: CurrencyCode): string {
  return `${CURRENCY_LABELS[code]} (${code})`;
}
