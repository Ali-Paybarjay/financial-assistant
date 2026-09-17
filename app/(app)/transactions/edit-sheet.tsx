"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { AmountInput } from "@/components/amount-input";
import { Field, FormError } from "@/components/field";
import { ConfidenceValue } from "@/components/confidence-rule";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { CategoryRow, TransactionRow } from "@/lib/supabase/database.types";
import {
  transactionFormSchema,
  type TransactionForm,
} from "@/lib/validation/transactions";
import { confirmTransaction, saveTransaction, softDeleteTransaction } from "./actions";

export function EditTransactionSheet({
  transaction,
  currency,
  categories,
  onClose,
  onDeleted,
}: {
  transaction: TransactionRow | null;
  currency: CurrencyCode;
  categories: CategoryRow[];
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
      occurredOn: "",
      merchant: "",
      note: "",
    },
  });

  useEffect(() => {
    if (!transaction) return;
    const slug = categories.find((entry) => entry.id === transaction.category_id)?.slug;
    reset({
      id: transaction.id,
      type: transaction.type,
      amount: formatMoney(transaction.amount, currency, { omitSymbol: true }).replace(
        /,/g,
        "",
      ),
      categorySlug: slug ?? "misc",
      occurredOn: transaction.occurred_on,
      merchant: transaction.merchant ?? "",
      note: transaction.note ?? "",
    });
    setFormError(undefined);
  }, [transaction, currency, categories, reset]);

  const type = watch("type");
  const visibleCategories = categories.filter((category) => category.kind === type);
  const needsReview = new Set(transaction?.needs_review ?? []);

  function onSubmit(values: TransactionForm) {
    startTransition(async () => {
      const result = await saveTransaction(values);
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
      {transaction && (
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
              </NativeSelect>
            </Field>
            <Field label="دسته" htmlFor="edit-category">
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="تاریخ" htmlFor="edit-date" error={errors.occurredOn?.message}>
              <Input id="edit-date" type="date" dir="ltr" {...register("occurredOn")} />
            </Field>
            <Field label="فروشنده" htmlFor="edit-merchant">
              <Input id="edit-merchant" placeholder="اختیاری" {...register("merchant")} />
            </Field>
          </div>

          <input type="hidden" {...register("id")} />

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
