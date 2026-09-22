"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowClockwise, CheckCircle, Warning } from "@phosphor-icons/react/dist/ssr";
import { PageSheet } from "@/components/page";
import { Button } from "@/components/ui/button";
import { StatementUploader } from "@/components/import/statement-uploader";
import { StatementReport } from "@/components/import/statement-report";
import { BalanceStep } from "@/components/import/balance-step";
import { faNumber } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import type { CurrencyCode } from "@/lib/money";
import type {
  AccountRow,
  CategoryRow,
  StatementImportRow,
  StatementLineRow,
} from "@/lib/supabase/database.types";
import { discardStatementImport, type ApplyResult } from "./actions";

/** What the report hands back once the rows are written. */
type AppliedState = Extract<ApplyResult, { ok: true }>;

export function ImportView({
  currency,
  sourceOptions,
  categories,
  accounts,
  defaultAccountId,
  lockedAccountId,
  current,
  lines,
  history,
  today,
}: {
  currency: CurrencyCode;
  sourceOptions: CurrencyCode[];
  categories: CategoryRow[];
  accounts: AccountRow[];
  defaultAccountId: string | null;
  /** Set when the page was opened from one account's update button. */
  lockedAccountId: string | null;
  current: StatementImportRow | null;
  lines: StatementLineRow[];
  history: StatementImportRow[];
  today: string;
}) {
  const router = useRouter();
  const lockedAccount = accounts.find((account) => account.id === lockedAccountId);
  const [applied, setApplied] = useState<AppliedState | null>(null);
  const [balanceDone, setBalanceDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <PageSheet className="px-4 py-4 min-[960px]:px-7 min-[960px]:py-6">
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold text-ink">
          {lockedAccount ? `بروزرسانی ${lockedAccount.title}` : "صورت‌حساب بانکی"}
        </h1>
        <p className="mt-1 text-caption text-ink-muted">
          {lockedAccount
            ? "پرینت این حساب را بده؛ جاماندها را پیدا می‌کنم، اضافه می‌کنم، و موجودی را با بانک یکی می‌کنم."
            : "پرینت حساب را بده؛ نگاه می‌کنم کدام ورودی و خروجی‌ها قبلاً ثبت شده‌اند و فقط تازه‌ها را اضافه می‌کنم."}
        </p>
      </header>

      {applied ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-2 rounded-control border border-positive/25 bg-positive-tint px-3 py-3 text-body font-medium text-positive">
            <CheckCircle size={20} className="mt-0.5 shrink-0" />
            {applied.imported === 0
              ? "چیزی ثبت نشد."
              : `${faNumber(applied.imported)} تراکنش ثبت شد.`}
            {applied.skipped > 0 &&
              ` ${faNumber(applied.skipped)} ردیف را رد کردی.`}
          </p>

          {/* The rows are in. Now the part the rows cannot answer: whether the
              account actually holds what the ledger says it does. */}
          {applied.balance && !balanceDone && current && (
            <BalanceStep
              accountTitle={applied.balance.accountTitle}
              ours={applied.balance.ours}
              theirs={applied.balance.theirs}
              theirsOn={applied.balance.theirsOn}
              importId={current.id}
              currency={currency}
              today={today}
              onDone={() => setBalanceDone(true)}
            />
          )}

          <div className="flex gap-2">
            <Button size="lg" className="flex-1" asChild>
              <Link href="/transactions">دیدن تراکنش‌ها</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                setApplied(null);
                setBalanceDone(false);
              }}
            >
              صورت‌حساب دیگر
            </Button>
          </div>
        </div>
      ) : current?.status === "review" ? (
        <StatementReport
          // A fresh instance per import: the report keeps the user's edits in
          // state, and a second upload must not inherit the first one's.
          key={current.id}
          statementImport={current}
          lines={lines}
          categories={categories}
          accountTitle={
            accounts.find((account) => account.id === current.account_id)?.title
          }
          currency={currency}
          onApplied={setApplied}
        />
      ) : current?.status === "parsing" ? (
        <div className="flex flex-col gap-3 rounded-well bg-paper p-4">
          <p className="flex items-start gap-2 text-body text-ink">
            <ArrowClockwise size={20} className="mt-0.5 shrink-0 text-ink-muted" />
            هنوز دارم این صورت‌حساب را می‌خوانم. می‌توانی صفحه را ببندی و بعداً برگردی.
          </p>
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => router.refresh()}>
              تازه کن
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await discardStatementImport(current.id);
                  router.refresh();
                })
              }
            >
              لغو
            </Button>
          </div>
        </div>
      ) : (
        <>
          {current?.status === "failed" && current.error_message && (
            <p
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-control border border-negative/25 bg-negative-tint px-3 py-2.5 text-caption font-medium text-negative"
            >
              <Warning size={16} className="mt-0.5 shrink-0" />
              {current.error_message}
            </p>
          )}
          <StatementUploader
            currency={currency}
            sourceOptions={sourceOptions}
            accounts={accounts}
            defaultAccountId={defaultAccountId}
            lockedAccountId={lockedAccountId}
          />
        </>
      )}

      {history.length > 0 && !applied && current?.status !== "review" && (
        <section className="mt-8">
          <h2 className="mb-2 text-[15px] font-semibold text-ink">صورت‌حساب‌های قبلی</h2>
          <ul className="overflow-hidden">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline justify-between gap-3 border-b border-hairline px-3 py-2.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-caption text-ink">
                    {entry.period_from && entry.period_to
                      ? `${formatDateFa(entry.period_from)} تا ${formatDateFa(entry.period_to)}`
                      : "بدون دوره"}
                  </span>
                  <span className="block text-micro text-ink-faint">
                    {STATUS_LABEL[entry.status] ?? entry.status}
                  </span>
                </span>
                {entry.status === "applied" && (
                  <span className="shrink-0 text-caption text-ink-muted">
                    {faNumber(entry.imported_count)} از {faNumber(entry.line_count)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageSheet>
  );
}

const STATUS_LABEL: Record<string, string> = {
  applied: "ثبت شد",
  failed: "خوانده نشد",
  discarded: "رها شد",
};
