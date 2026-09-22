import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { requireViewer } from "@/lib/auth";
import { listAccountsWithBalances } from "@/lib/queries/accounts";
import { listOpenDongGroups } from "@/lib/queries/dong";
import { monthTotals } from "@/lib/queries/transactions";
import { totalBalance } from "@/lib/accounts";
import { standing } from "@/lib/dong";
import { monthRange, todayInTimeZone } from "@/lib/date";
import { faNumber } from "@/lib/format";
import { WORKSPACE_ICON } from "@/components/app-shell/nav-items";
import { Money } from "@/components/money";
import { HubSignOutButton } from "@/components/sign-out";
import { WORKSPACES } from "@/lib/workspaces";

/**
 * The first screen after signing in: two boxes, one per side of the app.
 *
 * Each carries the one number that side is about, so the choice is made on
 * what is actually going on rather than on two labels — and so the trip you
 * are not opening still gets to say that somebody owes you.
 *
 * Nothing here is a summary of both. There is no number that is true of the
 * two of them together: a group in euros and an account in tomans cannot be
 * added, and «کل دارایی» that quietly includes what six people owe each other
 * would be the most misleading figure in the product.
 */
export default async function HubPage() {
  const viewer = await requireViewer();

  const today = todayInTimeZone(viewer.timeZone);
  const month = monthRange(viewer.timeZone, today);

  const [accounts, totals, dongGroups] = await Promise.all([
    listAccountsWithBalances(),
    monthTotals(month.from, month.to),
    listOpenDongGroups(),
  ]);

  const firstName = (viewer.profile.full_name ?? "").trim().split(" ")[0];
  const hasLedger = accounts.length > 0 || totals.income > 0 || totals.expense > 0;
  const openGroups = dongGroups.length;
  // Sorted by how much the viewer is in or out of pocket, so the first one is
  // the one worth putting on the card.
  const loudest = dongGroups[0];

  return (
    // The one screen with no sheet of its own: it is a fork in the road, not a
    // page, so the two things you choose between are the sheets.
    <div className="mx-auto w-full max-w-[760px] px-4 py-7 min-[720px]:py-10">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-question font-bold text-ink">
            {firstName ? `سلام ${firstName}` : "سلام"}
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-caption text-ink-muted">
            دو بخش جدا: حساب‌وکتاب خودت، و حساب‌وکتاب چندنفره. هر وقت خواستی از بالای
            صفحه بینشان جابه‌جا شو.
          </p>
        </div>
        {/* The shell hangs no nav on this page, so without this the only way
            off the account is through a workspace you did not come here for. */}
        <HubSignOutButton />
      </header>

      <div className="grid gap-4 min-[720px]:grid-cols-2">
        <WorkspaceCard
          workspace="personal"
          headline={
            hasLedger ? (
              <Money
                minor={totals.income - totals.expense}
                currency={viewer.currency}
                size="inherit"
                className="text-figure-lg font-bold"
                signed
                tone="auto"
              />
            ) : (
              <span className="text-figure-lg font-semibold text-ink-muted">—</span>
            )
          }
          headlineLabel={hasLedger ? "مانده‌ی این ماه" : "هنوز چیزی ثبت نکرده‌ای"}
          footer={
            accounts.length > 0 ? (
              <>
                موجودی {faNumber(accounts.filter((a) => a.is_active).length)} حساب:{" "}
                <Money
                  minor={totalBalance(accounts)}
                  currency={viewer.currency}
                  omitSymbol
                />
              </>
            ) : (
              "اولین خرجت را ثبت کن یا یک حساب بساز."
            )
          }
        />

        <WorkspaceCard
          workspace="dong"
          headline={
            loudest && loudest.net !== null && loudest.net !== 0 ? (
              <Money
                minor={loudest.net}
                currency={loudest.currency}
                size="inherit"
                className="text-figure-lg font-bold"
                signed
                tone="auto"
              />
            ) : (
              <span className="text-figure-lg font-semibold text-ink-muted">
                {openGroups > 0 ? "صاف" : "—"}
              </span>
            )
          }
          headlineLabel={
            loudest && loudest.net !== null && loudest.net !== 0
              ? `${standing(loudest.net) === "owed" ? "طلبت در" : "بدهی‌ات در"} «${loudest.title}»`
              : openGroups > 0
                ? "حسابت در دوره‌های باز صاف است"
                : "هنوز دوره‌ای نساخته‌ای"
          }
          footer={
            openGroups > 0
              ? `${faNumber(openGroups)} دوره‌ی باز`
              : "برای سفر یا دورهمی یک دوره بساز."
          }
        />
      </div>
    </div>
  );
}

function WorkspaceCard({
  workspace,
  headline,
  headlineLabel,
  footer,
}: {
  workspace: keyof typeof WORKSPACES;
  headline: React.ReactNode;
  headlineLabel: string;
  footer: React.ReactNode;
}) {
  const meta = WORKSPACES[workspace];
  const Glyph = WORKSPACE_ICON[workspace];

  return (
    <Link
      href={meta.href}
      className="group flex min-h-[200px] flex-col gap-3 rounded-card bg-surface p-5 shadow-lift transition-shadow hover:shadow-[0_2px_4px_rgb(25_26_46/0.06),0_18px_40px_-20px_rgb(25_26_46/0.45)]"
    >
      <span className="flex items-center gap-2.5">
        <Glyph size={20} className="shrink-0 text-ink-faint" />
        <span className="min-w-0 flex-1 text-[17px] font-semibold text-ink">
          {meta.title}
        </span>
        <CaretLeft
          size={16}
          className="shrink-0 text-ink-faint transition-colors group-hover:text-action"
        />
      </span>

      <span className="max-w-[46ch] text-caption text-ink-muted">{meta.blurb}</span>

      {/* The number this side of the app is about, given the bottom of the
          sheet to itself — the choice is made on what is actually going on,
          not on two labels. */}
      <span className="mt-auto flex flex-col gap-1 border-t border-hairline pt-3.5">
        <span className="text-caption text-ink-muted">{headlineLabel}</span>
        <span className="flex items-baseline justify-between gap-2">
          {headline}
          <span className="truncate text-caption text-ink-faint">{footer}</span>
        </span>
      </span>
    </Link>
  );
}
