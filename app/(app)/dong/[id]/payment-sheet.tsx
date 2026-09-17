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
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { DongMemberRow, DongPaymentRow } from "@/lib/supabase/database.types";
import {
  dongPaymentFormSchema,
  PAYMENT_KIND_HINT,
  PAYMENT_KIND_OPTIONS,
  type DongPaymentForm,
  type PaymentKindValue,
} from "@/lib/validation/dong";
import { deleteDongPayment, saveDongPayment } from "../actions";

/** A payment the settlement table proposed, ready to be confirmed as made. */
export type PaymentDraft = {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
};

export function PaymentSheet({
  open,
  onOpenChange,
  groupId,
  members,
  currency,
  today,
  payment,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: DongMemberRow[];
  currency: CurrencyCode;
  today: string;
  payment: DongPaymentRow | null;
  draft: PaymentDraft | null;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<DongPaymentForm>({
    resolver: zodResolver(dongPaymentFormSchema),
    defaultValues: {
      groupId,
      fromMemberId: members[0]?.id ?? "",
      toMemberId: members[1]?.id ?? "",
      amount: "",
      kind: "settle",
      occurredOn: today,
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;

    if (payment) {
      reset({
        groupId,
        fromMemberId: payment.from_member_id,
        toMemberId: payment.to_member_id,
        amount: formatMoney(payment.amount, currency, { omitSymbol: true }).replace(/,/g, ""),
        kind: payment.kind,
        occurredOn: payment.occurred_on,
        note: payment.note ?? "",
      });
    } else if (draft) {
      // Straight from the settlement table: the two people and the amount are
      // already decided, so all that is left is to confirm it happened.
      reset({
        groupId,
        fromMemberId: draft.fromMemberId,
        toMemberId: draft.toMemberId,
        amount: formatMoney(draft.amount, currency, { omitSymbol: true }).replace(/,/g, ""),
        kind: "settle",
        occurredOn: today,
        note: "",
      });
    } else {
      reset({
        groupId,
        fromMemberId: members[0]?.id ?? "",
        toMemberId: members[1]?.id ?? "",
        amount: "",
        kind: "settle",
        occurredOn: today,
        note: "",
      });
    }

    setFormError(undefined);
  }, [open, payment, draft, groupId, members, currency, today, reset]);

  const kind = (watch("kind") ?? "settle") as PaymentKindValue;

  function onSubmit(values: DongPaymentForm) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveDongPayment({ ...values, id: payment?.id });
      if ("error" in result) setFormError(result.error);
      else {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  function onDelete() {
    if (!payment) return;
    setFormError(undefined);
    startTransition(async () => {
      const result = await deleteDongPayment(payment.id, groupId);
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
      title={payment ? "ویرایش پرداخت" : "پرداخت تازه"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        <div className="grid grid-cols-2 gap-3">
          <Field label="از" htmlFor="payment-from" error={errors.fromMemberId?.message}>
            <NativeSelect id="payment-from" {...register("fromMemberId")}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="به" htmlFor="payment-to" error={errors.toMemberId?.message}>
            <NativeSelect id="payment-to" {...register("toMemberId")}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <Field label="مبلغ" htmlFor="payment-amount" error={errors.amount?.message}>
          <AmountInput
            id="payment-amount"
            currency={currency}
            size="hero"
            placeholder="0"
            {...register("amount")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="بابت چه" htmlFor="payment-kind" hint={PAYMENT_KIND_HINT[kind]}>
            <NativeSelect id="payment-kind" {...register("kind")}>
              {PAYMENT_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="تاریخ" htmlFor="payment-date" error={errors.occurredOn?.message}>
            <Input id="payment-date" type="date" dir="ltr" {...register("occurredOn")} />
          </Field>
        </div>

        <Field label="توضیح" htmlFor="payment-note">
          <Input id="payment-note" placeholder="اختیاری" {...register("note")} />
        </Field>

        <Button type="submit" size="lg" disabled={isPending}>
          {payment ? "ذخیره" : "ثبت پرداخت"}
        </Button>

        {payment && (
          <Button type="button" variant="ghost" onClick={onDelete} disabled={isPending}>
            <Trash size={16} />
            حذف پرداخت
          </Button>
        )}
      </form>
    </BottomSheet>
  );
}
