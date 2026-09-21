"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CaretLeft, Trash, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { AmountInput } from "@/components/amount-input";
import { Field, FormError } from "@/components/field";
import { ConfidenceValue } from "@/components/confidence-rule";
import { AccountField } from "@/components/accounts/account-field";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type {
  AccountRow,
  CategoryRow,
  GoalRow,
  TransactionRow,
} from "@/lib/supabase/database.types";
import {
  transactionFormSchema,
  type TransactionForm,
} from "@/lib/validation/transactions";
import { confirmTransaction, saveTransaction, softDeleteTransaction } from "./actions";

export function EditTransactionSheet({
  transaction,
  currency,
  categories,
  accounts,
  goals,
  onClose,
  onDeleted,
}: {
  transaction: TransactionRow | null;
  currency: CurrencyCode;
  categories: CategoryRow[];
  accounts: AccountRow[];
  /** Every goal, open or closed. Which of them to offer is decided below. */
  goals: GoalRow[];
  onClose: () => void;
  onDeleted: (id: string, title: string) => void;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TransactionForm>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: "expense",
      amount: "",
      categorySlug: "groceries",
      accountId: "",
      toAccountId: "",
      goalId: "",
      occurredOn: "",
      merchant: "",
      note: "",
    },
  });

  useEffect(() => {
    if (!transaction) return;
    const slug = categories.find((entry) => entry.id === transaction.category_id)?.slug;
    reset({
      type: transaction.type,
      amount: formatMoney(transaction.amount, currency, { omitSymbol: true }).replace(
        /,/g,
        "",
      ),
      categorySlug: slug ?? "misc",
      accountId: transaction.account_id ?? "",
      toAccountId: transaction.to_account_id ?? "",
      goalId: transaction.goal_id ?? "",
      occurredOn: transaction.occurred_on,
      merchant: transaction.merchant ?? "",
      note: transaction.note ?? "",
    });
    setFormError(undefined);
  }, [transaction, currency, categories, reset]);

  /**
   * A row «دنگ و دونگ» wrote is shown, not edited: the database keeps it in
   * step with the purchase behind it, so anything typed here would be undone
   * the next time that purchase is touched. The way to change it is to change
   * what it reflects, and the sheet says so and offers the door.
   */
  const fromDong = transaction?.dong_group_id ?? null;

  const type = watch("type");
  const toAccountId = watch("toAccountId");
  const isTransfer = type === "transfer";
  const visibleCategories = categories.filter((category) => category.kind === type);
  const needsReview = new Set(transaction?.needs_review ?? []);

  // The open goals, plus whichever one this row already names even if it has
  // since been closed. Without that second half, opening a row tagged to a
  // closed goal and pressing save would quietly drop the tag — the select
  // would have no option matching it, so it would fall back to «هیچ‌کدام».
  const offerableGoals = goals.filter(
    (goal) => goal.status === "active" || goal.id === transaction?.goal_id,
  );

  const openAccounts = accounts.filter((account) => account.is_active);
  // A row that already is a transfer keeps the option even if one of its
  // accounts has since been closed; otherwise two open accounts are needed,
  // because with one there is nowhere to move money to.
  const canTransfer = transaction?.type === "transfer" || openAccounts.length >= 2;

  // Reclassifying is the point of this control, and a statement makes it
  // routine: a bank prints "transfer to savings" as an ordinary outflow, so it
  // imports as an expense and the month counts it as spending until someone
  // says otherwise. What it must not be is silent — the far account's balance
  // moves too, and that account is not the one on screen.
  const becomingTransfer = isTransfer && transaction?.type !== "transfer";
  const leavingTransfer = !isTransfer && transaction?.type === "transfer";
  const farAccount = accounts.find(
    (account) => account.id === (toAccountId || transaction?.to_account_id),
  );

  function onSubmit(values: TransactionForm) {
    startTransition(async () => {
      // The id comes from the row, not from a hidden form field: "" is not a
      // uuid, and nothing renders errors.id to say so.
      const result = await saveTransaction({ ...values, id: transaction?.id });
      if ("error" in result) setFormError(result.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <BottomSheet
      open={Boolean(transaction)}
      onOpenChange={(open) => !open && onClose()}
      title="ویرایش تراکنش"
    >
      {transaction && fromDong && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-control border border-hairline bg-paper p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lapis-tint text-lapis">
              <UsersThree size={18} />
            </span>
            <p className="text-caption text-ink-muted">
              این ردیف را «دنگ و دونگ» نوشته است — بازتاب یک خرید یا پرداخت مشترک
              که از حساب تو رفته یا به آن آمده. مبلغ و تاریخش همان‌جا عوض می‌شود،
              و اینجا خودش به‌روز می‌شود.
            </p>
          </div>

          <Field label="شرح" htmlFor="dong-note">
            <Input id="dong-note" readOnly value={transaction.note ?? ""} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="مبلغ" htmlFor="dong-amount">
              <Input
                id="dong-amount"
                readOnly
                dir="ltr"
                value={formatMoney(transaction.amount, currency)}
              />
            </Field>
            <Field label="تاریخ" htmlFor="dong-date">
              <Input id="dong-date" readOnly dir="ltr" value={transaction.occurred_on} />
            </Field>
          </div>

          <Button asChild size="lg">
            <Link href={`/dong/${fromDong}`}>
              رفتن به آن دوره
              <CaretLeft size={16} />
            </Link>
          </Button>
        </div>
      )}

      {transaction && !fromDong && (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormError>{formError}</FormError>

          {!transaction.is_confirmed && (
            <div className="flex flex-col gap-3 rounded-control border border-guess-border bg-guess-tint p-3">
              <p className="text-caption font-medium text-guess-text">
                این تراکنش را از روی {transaction.source === "receipt" ? "عکس فاکتور" : "چیزی که گفتی"} برداشت
                کردم و هنوز تأیید نکرده‌ای.
              </p>
              <div className="flex flex-wrap gap-4">
                {[...needsReview].map((field) => (
                  <ConfidenceValue key={field} isGuess label={field}>
                    {String(field)}
                  </ConfidenceValue>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await confirmTransaction(transaction.id);
                    onClose();
                    router.refresh();
                  })
                }
              >
                درست است، تأیید می‌کنم
              </Button>
            </div>
          )}

          <Field label="مبلغ" htmlFor="edit-amount" error={errors.amount?.message}>
            <AmountInput id="edit-amount" size="hero" currency={currency} {...register("amount")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="نوع" htmlFor="edit-type">
              <NativeSelect id="edit-type" {...register("type")}>
                <option value="expense">هزینه</option>
                <option value="income">درآمد</option>
                {canTransfer && <option value="transfer">انتقال</option>}
              </NativeSelect>
            </Field>
            <Field label="دسته" htmlFor="edit-category" className={isTransfer ? "hidden" : undefined}>
              <Controller
                control={control}
                name="categorySlug"
                render={({ field }) => (
                  <NativeSelect
                    id="edit-category"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                  >
                    {visibleCategories.map((category) => (
                      <option key={category.id} value={category.slug}>
                        {category.name_fa}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              />
            </Field>
          </div>

          <AccountField
            id="edit-account"
            label={isTransfer ? "از حساب" : "حساب"}
            accounts={accounts}
            selectedId={transaction.account_id}
            allowNone={!isTransfer}
            error={errors.accountId?.message}
            {...register("accountId")}
          />

          {isTransfer && (
            <AccountField
              id="edit-to-account"
              label="به حساب"
              accounts={accounts}
              selectedId={transaction.to_account_id}
              allowNone={false}
              error={errors.toAccountId?.message}
              {...register("toAccountId")}
            />
          )}

          {/* Income is never goal money, so the question is not asked there.
              On a transfer this says «I set this aside for X»; on an expense,
              «I spent X's money on it» — which is the day saved money finally
              becomes a spend. */}
          {type !== "income" && offerableGoals.length > 0 && (
            <Field
              label="بابت کدام هدف؟"
              htmlFor="edit-goal"
              hint={
                isTransfer
                  ? "اگر این انتقال پس‌اندازِ یک هدف است، اینجا بگو تا پای همان هدف نوشته شود."
                  : "اگر این خرید از پس‌انداز همان هدف بوده، اینجا بگو تا از موجودی هدف کم شود."
              }
            >
              <NativeSelect id="edit-goal" {...register("goalId")}>
                <option value="">هیچ‌کدام</option>
                {offerableGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}

          {(becomingTransfer || leavingTransfer) && (
            <p
              data-testid="type-change-note"
              className="rounded-control border border-guess-border bg-guess-tint px-3 py-2.5 text-caption font-medium text-guess-text"
            >
              {becomingTransfer
                ? "با ذخیره، این مبلغ به موجودی حسابِ مقصد اضافه می‌شود و دیگر در هزینه و درآمد این ماه شمرده نمی‌شود."
                : `با ذخیره، این مبلغ دیگر به ${farAccount?.title ?? "حساب مقصد"} اضافه نمی‌شود — موجودی آن حساب همین‌قدر کم می‌شود — و از این به بعد در هزینه و درآمد ماه شمرده می‌شود.`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="تاریخ" htmlFor="edit-date" error={errors.occurredOn?.message}>
              <Input id="edit-date" type="date" dir="ltr" {...register("occurredOn")} />
            </Field>
            {isTransfer ? (
              <Field label="توضیح" htmlFor="edit-note">
                <Input id="edit-note" placeholder="اختیاری" {...register("note")} />
              </Field>
            ) : (
              <Field label="فروشنده" htmlFor="edit-merchant">
                <Input id="edit-merchant" placeholder="اختیاری" {...register("merchant")} />
              </Field>
            )}
          </div>

          <div className="mt-2 flex gap-2">
            <Button type="submit" size="lg" className="flex-1" disabled={isPending}>
              {isPending ? "دارم ذخیره می‌کنم…" : "ذخیره"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              aria-label="حذف"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const title =
                    transaction.merchant || transaction.note || "این تراکنش";
                  await softDeleteTransaction(transaction.id);
                  onDeleted(transaction.id, title);
                  router.refresh();
                })
              }
            >
              <Trash size={18} />
            </Button>
          </div>
        </form>
      )}
    </BottomSheet>
  );
}
