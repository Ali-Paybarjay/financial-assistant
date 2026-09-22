"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { AmountInput } from "@/components/amount-input";
import { Field, FormError } from "@/components/field";
import { Money } from "@/components/money";
import { formatDateFa } from "@/lib/date";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { AccountWithBalance } from "@/lib/accounts";
import {
  ACCOUNT_KIND_OPTIONS,
  accountFormSchema,
  type AccountForm,
} from "@/lib/validation/accounts";
import { deleteAccount, restateBalance, saveAccount, setAccountActive } from "./actions";

/** The stored integer back into something the amount field can hold. */
function amountText(minor: number, currency: CurrencyCode): string {
  return formatMoney(minor, currency, { omitSymbol: true }).replace(/,/g, "");
}

export function AccountSheet({
  open,
  onOpenChange,
  currency,
  today,
  account,
  isFirst,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  today: string;
  account: AccountWithBalance | null;
  isFirst: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      title: "",
      kind: "checking",
      balance: "",
      balanceOn: today,
      institution: "",
      reference: "",
      isDefault: isFirst,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      account
        ? {
            title: account.title,
            kind: account.kind,
            balance: amountText(account.opening_balance, currency),
            balanceOn: account.opening_balance_on,
            institution: account.institution ?? "",
            reference: account.reference ?? "",
            isDefault: account.is_default,
          }
        : {
            title: "",
            kind: "checking",
            balance: "",
            balanceOn: today,
            institution: "",
            reference: "",
            isDefault: isFirst,
          },
    );
    setFormError(undefined);
  }, [open, account, currency, today, isFirst, reset]);

  function onSubmit(values: AccountForm) {
    setFormError(undefined);
    startTransition(async () => {
      // The id comes from the row being edited, never from a form field: a
      // hidden input gives back "" for a new account, and "" is not a uuid.
      const result = await saveAccount({ ...values, id: account?.id });
      if ("error" in result) setFormError(result.error);
      else {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  function run(action: () => Promise<{ error: string } | { ok: true }>) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setFormError(result.error);
      else {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={account ? "ویرایش حساب" : "حساب تازه"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        {account && account.transactionCount > 0 && (
          <div className="flex items-baseline justify-between rounded-control border border-hairline bg-paper px-3 py-2.5">
            <span className="text-caption text-ink-muted">موجودی الان</span>
            <Money
              minor={account.balance}
              currency={currency}
              size="kpi"
              className={account.balance < 0 ? "text-negative" : "text-ink"}
            />
          </div>
        )}

        <Field label="اسم حساب" htmlFor="account-title" error={errors.title?.message}>
          <Input id="account-title" placeholder="مثلاً حساب حقوق" {...register("title")} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="نوع" htmlFor="account-kind">
            <NativeSelect id="account-kind" {...register("kind")}>
              {ACCOUNT_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="بانک" htmlFor="account-institution">
            <Input
              id="account-institution"
              placeholder="اختیاری"
              {...register("institution")}
            />
          </Field>
        </div>

        <Field
          label="موجودی"
          htmlFor="account-balance"
          error={errors.balance?.message}
          hint="اگر کارت اعتباری است و بدهکاری، با علامت منفی بنویس."
        >
          <AmountInput
            id="account-balance"
            currency={currency}
            placeholder="0"
            {...register("balance")}
          />
        </Field>

        <Field
          label="این موجودی مالِ چه تاریخی است"
          htmlFor="account-balance-on"
          error={errors.balanceOn?.message}
          hint="هرچه از این تاریخ به بعد به این حساب بخورد موجودی را عوض می‌کند، نه قبلش."
        >
          <Input id="account-balance-on" type="date" dir="ltr" {...register("balanceOn")} />
        </Field>

        <Field label="چهار رقم آخر کارت یا شماره‌ی حساب" htmlFor="account-reference">
          <Input
            id="account-reference"
            placeholder="اختیاری"
            dir="ltr"
            {...register("reference")}
          />
        </Field>

        <label className="flex items-center gap-2.5 rounded-control border border-hairline bg-paper px-3 py-2.5">
          <input type="checkbox" className="size-4 accent-action" {...register("isDefault")} />
          <span className="text-caption text-ink">
            موقع ثبت هزینه، پیش‌فرض همین حساب انتخاب باشد
          </span>
        </label>

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "دارم ذخیره می‌کنم…" : "ذخیره"}
        </Button>

        {account && (
          <div className="flex flex-col gap-2 border-t border-hairline pt-3">
            <RestateBalance
              account={account}
              currency={currency}
              today={today}
              isPending={isPending}
              onRun={run}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isPending}
                onClick={() => run(() => setAccountActive(account.id, !account.is_active))}
              >
                {account.is_active ? "بستن حساب" : "باز کردن دوباره"}
              </Button>
              {account.transactionCount === 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="پاک کردن حساب"
                  disabled={isPending}
                  onClick={() => run(() => deleteAccount(account.id))}
                >
                  <Trash size={18} className="text-negative" />
                </Button>
              )}
            </div>

            <p className="text-caption text-ink-muted">
              بستن حساب چیزی را پاک نمی‌کند؛ تراکنش‌هایش سر جایشان می‌مانند و حساب فقط از
              فهرستِ ثبتِ تازه بیرون می‌رود.
            </p>
          </div>
        )}
      </form>
    </BottomSheet>
  );
}

/**
 * "The bank says something else."
 *
 * Rather than making the user hunt for the row that is missing, they restate
 * what the account holds and as of when. The anchor moves; nothing already
 * recorded is touched, and the difference is absorbed rather than explained.
 */
function RestateBalance({
  account,
  currency,
  today,
  isPending,
  onRun,
}: {
  account: AccountWithBalance;
  currency: CurrencyCode;
  today: string;
  isPending: boolean;
  onRun: (action: () => Promise<{ error: string } | { ok: true }>) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [balance, setBalance] = useState("");
  const [balanceOn, setBalanceOn] = useState(today);

  if (!panelOpen) {
    return (
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="self-start text-caption font-medium text-action hover:underline"
      >
        بانک عدد دیگری می‌گوید؟ موجودی را از نو بنویس
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-control border border-hairline bg-paper p-3">
      <p className="text-caption text-ink-muted">
        عددی که الان واقعاً در حسابت هست را بنویس. مبنای شمارش از{" "}
        {formatDateFa(account.opening_balance_on)} به تاریخ تازه می‌آید؛ تراکنش‌های قبل از
        آن دیگر در موجودی شمرده نمی‌شوند، ولی هیچ‌کدام پاک نمی‌شوند.
      </p>

      <Field label="موجودی واقعی" htmlFor="restate-balance">
        <AmountInput
          id="restate-balance"
          currency={currency}
          value={balance}
          onChange={(event) => setBalance(event.target.value)}
        />
      </Field>

      <Field label="در تاریخ" htmlFor="restate-on">
        <Input
          id="restate-on"
          type="date"
          dir="ltr"
          value={balanceOn}
          onChange={(event) => setBalanceOn(event.target.value)}
        />
      </Field>

      <Button
        type="button"
        variant="outline"
        disabled={isPending || balance.trim() === ""}
        onClick={() => onRun(() => restateBalance({ id: account.id, balance, balanceOn }))}
      >
        ثبت موجودی تازه
      </Button>
    </div>
  );
}
