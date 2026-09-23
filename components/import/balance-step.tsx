"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Scales } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/amount-input";
import { Field, FormError } from "@/components/field";
import { Money } from "@/components/money";
import { formatDateFa } from "@/lib/date";
import { formatMoney, toMinor, type CurrencyCode } from "@/lib/money";
import { applyStatementBalance } from "@/app/(app)/import/actions";

/**
 * The second half of an update, and the half that makes it worth doing.
 *
 * Importing the missing rows closes the gap the app knows about. This closes
 * the gap it does not: a fee nobody itemised, a row the model dropped, a
 * purchase made before the account was ever added. Whatever difference is left
 * is absorbed by moving the balance's anchor date forward — nothing already
 * recorded is touched, and no invented "adjustment" appears in the user's
 * expenses for money they never spent.
 *
 * The bank's figure arrives read off a page, so it wears the dashed rule and
 * is editable, like every other thing a model read. When the statement printed
 * no balance the field is simply empty and the user types what their bank app
 * shows — which is the same question, asked of a better source.
 */
export function BalanceStep({
  accountTitle,
  ours,
  theirs,
  theirsOn,
  importId,
  currency,
  today,
  onDone,
}: {
  accountTitle: string;
  ours: number;
  theirs: number | null;
  theirsOn: string | null;
  importId: string;
  currency: CurrencyCode;
  today: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [balance, setBalance] = useState(
    theirs === null ? "" : formatMoney(theirs, currency, { omitSymbol: true }).replace(/,/g, ""),
  );
  const [balanceOn, setBalanceOn] = useState(theirsOn ?? today);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  // Recomputed as the user types, so the difference is never stale against the
  // number sitting directly above it.
  let stated: number | null = null;
  try {
    stated = balance.trim() === "" ? null : toMinor(balance, currency);
  } catch {
    stated = null;
  }

  const difference = stated === null ? null : stated - ours;
  const agrees = difference === 0;

  function apply() {
    setError(undefined);
    startTransition(async () => {
      const result = await applyStatementBalance({ importId, balance, balanceOn });
      if ("error" in result) setError(result.error);
      else {
        router.refresh();
        onDone();
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <Scales size={18} className="text-action" />
        موجودی {accountTitle}
      </h2>

      <FormError>{error}</FormError>

      <dl className="flex flex-col gap-2 rounded-control border border-hairline bg-paper p-3">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-caption text-ink-muted">طبق دفترِ من</dt>
          <dd>
            <Money
              minor={ours}
              currency={currency}
              size="row"
              className={ours < 0 ? "text-negative" : "text-ink"}
            />
          </dd>
        </div>

        {difference !== null && (
          <div className="flex items-baseline justify-between gap-2 border-t border-hairline pt-2">
            <dt className="text-caption text-ink-muted">اختلاف</dt>
            <dd>
              {agrees ? (
                <span className="flex items-center gap-1 text-caption font-medium text-positive">
                  <CheckCircle size={15} />
                  می‌خواند
                </span>
              ) : (
                <Money
                  minor={difference}
                  currency={currency}
                  size="row"
                  signed
                  tone="auto"
                />
              )}
            </dd>
          </div>
        )}
      </dl>

      <Field
        label="بانک چه عددی نشان می‌دهد؟"
        htmlFor="statement-balance"
        // Exactly what Field's note slot exists for: a control the app filled
        // in itself, saying so beside the label until the user touches it.
        note={theirs !== null && !touched ? "از صورت‌حساب خواندم" : undefined}
        hint={
          theirs === null
            ? "صورت‌حساب مانده‌ی پایان دوره نداشت. عددی که در اپ بانکت می‌بینی را بنویس."
            : undefined
        }
      >
        <AmountInput
          id="statement-balance"
          currency={currency}
          value={balance}
          onChange={(event) => {
            setTouched(true);
            setBalance(event.target.value);
          }}
        />
      </Field>

      <Field label="این عدد مالِ چه تاریخی است" htmlFor="statement-balance-on">
        <Input
          id="statement-balance-on"
          type="date"
          dir="ltr"
          value={balanceOn}
          onChange={(event) => setBalanceOn(event.target.value)}
        />
      </Field>

      {difference !== null && !agrees && (
        <p className="rounded-control border border-guess-border bg-guess-tint px-3 py-2.5 text-caption font-medium text-guess-text">
          {difference > 0
            ? "بانک بیشتر از دفترِ من نشان می‌دهد — یعنی پولی وارد شده که ثبت نشده."
            : "بانک کمتر از دفترِ من نشان می‌دهد — یعنی خرجی شده که ثبت نشده."}{" "}
          با زدن دکمه، مبنای شمارش به {formatDateFa(balanceOn)} می‌آید و این اختلاف
          جذب می‌شود. هیچ تراکنشی پاک یا ساخته نمی‌شود.
        </p>
      )}

      <div className="flex gap-2">
        <Button
          size="lg"
          className="flex-1"
          disabled={isPending || stated === null}
          onClick={apply}
        >
          {isPending
            ? "دارم ثبت می‌کنم…"
            : agrees
              ? "تأیید می‌کنم، همین است"
              : "موجودی را با بانک یکی کن"}
        </Button>
        <Button size="lg" variant="outline" disabled={isPending} onClick={onDone}>
          فعلاً نه
        </Button>
      </div>
    </section>
  );
}
