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
import { WORKSPACE_ICON } from "@/components/app-shell/workspace-switch";
import { Money } from "@/components/money";
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
    <div className="mx-auto w-full max-w-[720px] px-4 py-6">
      <header className="mb-5">
        <h1 className="text-title font-semibold text-ink">
          {firstName ? `سلام ${firstName}` : "سلام"}
        </h1>
        <p className="mt-1 text-caption text-ink-muted">
          دو بخش جدا: حساب‌وکتاب خودت، و حساب‌وکتاب چندنفره. هر وقت خواستی از بالای
          صفحه بینشان جابه‌جا شو.
        </p>
      </header>

      <div className="grid gap-3 min-[720px]:grid-cols-2">
        <WorkspaceCard
          workspace="personal"
          headline={
            hasLedger ? (
              <Money
                minor={totals.income - totals.expense}
                currency={viewer.currency}
                size="kpi"
                signed
                tone="auto"
              />
            ) : (
              <span className="text-[16px] font-semibold text-ink-muted">—</span>
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
                size="kpi"
                signed
                tone="auto"
              />
            ) : (
              <span className="text-[16px] font-semibold text-ink-muted">
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
      className="flex min-h-[190px] flex-col gap-3 rounded-card border border-hairline bg-surface p-4 transition-colors hover:border-lapis hover:bg-lapis-tint/40"
    >
      <span className="flex items-center gap-2.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lapis-tint text-lapis">
          <Glyph size={20} />
        </span>
        <span className="min-w-0 flex-1 text-[17px] font-semibold text-ink">
          {meta.title}
        </span>
        <CaretLeft size={16} className="shrink-0 text-ink-faint" />
      </span>

      <span className="text-caption text-ink-muted">{meta.blurb}</span>

      <span className="mt-auto flex flex-col gap-0.5 border-t border-hairline pt-3">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-caption text-ink-muted">{headlineLabel}</span>
          {headline}
        </span>
        <span className="truncate text-caption text-ink-faint">{footer}</span>
      </span>
    </Link>
  );
}
