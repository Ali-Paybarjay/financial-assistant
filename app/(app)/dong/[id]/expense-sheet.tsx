"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { AmountInput } from "@/components/amount-input";
import { SegmentedControl } from "@/components/segmented-control";
import { Field, FormError } from "@/components/field";
import { Money } from "@/components/money";
import { MemberName } from "@/components/dong/rows";
import { formatMoney, toMinor, type CurrencyCode } from "@/lib/money";
import { splitByUnits, splitEqually, splitGap, type Share } from "@/lib/dong";
import type { DongMemberRow } from "@/lib/supabase/database.types";
import type { DongExpenseWithShares } from "@/lib/queries/dong";
import {
  DONG_TAG_OPTIONS,
  dongExpenseFormSchema,
  SPLIT_MODE_HINT,
  SPLIT_MODE_OPTIONS,
  type DongExpenseForm,
} from "@/lib/validation/dong";
import { deleteDongExpense, saveDongExpense } from "../actions";

/** The stored integer back into something the amount field can hold. */
function amountText(minor: number, currency: CurrencyCode): string {
  return formatMoney(minor, currency, { omitSymbol: true }).replace(/,/g, "");
}

/** Parse without throwing: the preview runs on every keystroke, including "۱۲٫". */
function tryMinor(text: string, currency: CurrencyCode): number | null {
  try {
    return toMinor(text || "0", currency);
  } catch {
    return null;
  }
}

export function ExpenseSheet({
  open,
  onOpenChange,
  groupId,
  members,
  currency,
  today,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: DongMemberRow[];
  currency: CurrencyCode;
  today: string;
  expense: DongExpenseWithShares | null;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  /**
   * The kitty can pay for something but never consumes it: its whole purpose
   * is to hold other people's money. Listing it among the people to split
   * between would invite an expense the fund itself owes for, which is not a
   * thing.
   */
  const people = useMemo(() => members.filter((member) => !member.is_fund), [members]);

  const defaults = useMemo<DongExpenseForm>(
    () => ({
      groupId,
      title: "",
      amount: "",
      paidBy: members.find((member) => member.is_me)?.id ?? members[0]?.id ?? "",
      occurredOn: today,
      tag: "",
      note: "",
      splitMode: "equal",
      // Everyone is in by default: the common case is a bill the whole group
      // shares, and unticking two people is less work than ticking four.
      shares: people.map((member) => ({
        memberId: member.id,
        included: true,
        units: 1,
        amount: "",
      })),
    }),
    [groupId, members, people, today],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DongExpenseForm>({
    resolver: zodResolver(dongExpenseFormSchema),
    defaultValues: defaults,
  });

  const { fields } = useFieldArray({ control, name: "shares" });

  useEffect(() => {
    if (!open) return;
    reset(
      expense
        ? {
            groupId,
            title: expense.title,
            amount: amountText(expense.amount, currency),
            paidBy: expense.paid_by_member_id,
            occurredOn: expense.occurred_on,
            tag: expense.tag ?? "",
            note: expense.note ?? "",
            splitMode: expense.split_mode,
            shares: people.map((member) => {
              const stored = expense.shares.find((share) => share.member_id === member.id);
              return {
                memberId: member.id,
                included: Boolean(stored),
                units: stored?.units ?? 1,
                amount: stored ? amountText(stored.amount, currency) : "",
              };
            }),
          }
        : defaults,
    );
    setFormError(undefined);
  }, [open, expense, groupId, currency, people, defaults, reset]);

  const watched = useWatch({ control });
  const splitMode = watched.splitMode ?? "equal";
  const totalMinor = tryMinor(watched.amount ?? "", currency);

  /**
   * The same functions the action will use, run on what is on screen. The user
   * sees the exact numbers that will be stored — including who picks up the
   * rounding — before they commit to them.
   */
  const preview = useMemo<Share[]>(() => {
    const rows = (watched.shares ?? []).filter((share) => share?.included);
    if (totalMinor === null || rows.length === 0) return [];

    if (splitMode === "equal") {
      return splitEqually(totalMinor, rows.map((share) => share!.memberId!));
    }
    if (splitMode === "shares") {
      return splitByUnits(
        totalMinor,
        rows.map((share) => ({
          memberId: share!.memberId!,
          units: Number(share!.units) || 1,
        })),
      );
    }
    return rows.map((share) => ({
      memberId: share!.memberId!,
      units: 1,
      amount: tryMinor(share!.amount ?? "", currency) ?? 0,
    }));
  }, [watched.shares, splitMode, totalMinor, currency]);

  const previewByMember = new Map(preview.map((share) => [share.memberId, share.amount]));
  const gap = totalMinor === null ? 0 : splitGap(totalMinor, preview);

  function onSubmit(values: DongExpenseForm) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveDongExpense({ ...values, id: expense?.id });
      if ("error" in result) setFormError(result.error);
      else {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  function onDelete() {
    if (!expense) return;
    setFormError(undefined);
    startTransition(async () => {
      const result = await deleteDongExpense(expense.id, groupId);
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
      title={expense ? "ویرایش خرید" : "خرید تازه"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        <Field label="چه چیزی" htmlFor="expense-title" error={errors.title?.message}>
          <Input id="expense-title" placeholder="مثلاً شام رستوران" {...register("title")} />
        </Field>

        <Field label="مبلغ" htmlFor="expense-amount" error={errors.amount?.message}>
          <AmountInput
            id="expense-amount"
            currency={currency}
            size="hero"
            placeholder="0"
            {...register("amount")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="پولش را چه کسی داد" htmlFor="expense-paid-by" error={errors.paidBy?.message}>
            <NativeSelect id="expense-paid-by" {...register("paidBy")}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="تاریخ" htmlFor="expense-date" error={errors.occurredOn?.message}>
            <Input id="expense-date" type="date" dir="ltr" {...register("occurredOn")} />
          </Field>
        </div>

        <Field label="برچسب" htmlFor="expense-tag">
          <Input
            id="expense-tag"
            list="dong-tags"
            placeholder="اختیاری — مثلاً خوراک"
            {...register("tag")}
          />
          <datalist id="dong-tags">
            {DONG_TAG_OPTIONS.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </Field>

        {/* ------------------------------------------------------- the split -- */}
        <div className="flex flex-col gap-2">
          <span className="text-label font-medium text-ink-muted">تقسیم بین</span>
          <SegmentedControl
            label="نحوه‌ی تقسیم"
            value={splitMode}
            onChange={(value) => setValue("splitMode", value)}
            segments={SPLIT_MODE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <p className="text-caption text-ink-muted">{SPLIT_MODE_HINT[splitMode]}</p>

          <div className="overflow-hidden rounded-control border border-hairline">
            {fields.map((field, index) => {
              const member = people.find((person) => person.id === field.memberId);
              const included = watched.shares?.[index]?.included ?? false;
              const share = previewByMember.get(field.memberId);

              return (
                <div
                  key={field.id}
                  className="flex items-center gap-2 border-b border-hairline px-3 py-2 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    aria-label={`سهم ${member?.name ?? ""}`}
                    className="size-4 shrink-0 accent-lapis"
                    {...register(`shares.${index}.included`)}
                  />
                  <MemberName
                    member={member}
                    className="min-w-0 flex-1 truncate text-[14px] text-ink"
                  />

                  {included && splitMode === "shares" && (
                    <input
                      type="number"
                      min={1}
                      max={99}
                      aria-label={`سهم عددی ${member?.name ?? ""}`}
                      className="h-9 w-14 rounded-control border border-hairline-strong bg-surface px-2 text-center text-[14px] tabular-nums outline-none focus-visible:border-lapis"
                      {...register(`shares.${index}.units`, { valueAsNumber: true })}
                    />
                  )}

                  {included && splitMode === "exact" && (
                    <AmountInput
                      currency={currency}
                      aria-label={`مبلغ ${member?.name ?? ""}`}
                      className="text-[14px]"
                      placeholder="0"
                      {...register(`shares.${index}.amount`)}
                    />
                  )}

                  {included && splitMode !== "exact" && share !== undefined && (
                    <Money minor={share} currency={currency} size="row" />
                  )}
                </div>
              );
            })}
          </div>

          {errors.shares?.message && (
            <p role="alert" className="text-caption font-medium text-negative">
              {errors.shares.message}
            </p>
          )}

          {/* The invariant the database enforces, said before the save rather
              than after: only 'exact' can get here, the other two always add up. */}
          {splitMode === "exact" && totalMinor !== null && gap !== 0 && (
            <p
              role="alert"
              className="rounded-control border border-guess-border bg-guess-tint px-3 py-2 text-caption font-medium text-guess-text"
            >
              {gap > 0 ? "هنوز " : "بیشتر از مبلغ خرید، به‌اندازه‌ی "}
              <Money minor={Math.abs(gap)} currency={currency} />
              {gap > 0 ? " پخش نشده." : "."}
            </p>
          )}
        </div>

        <Field label="توضیح" htmlFor="expense-note">
          <Input id="expense-note" placeholder="اختیاری" {...register("note")} />
        </Field>

        <Button type="submit" size="lg" disabled={isPending}>
          {expense ? "ذخیره" : "ثبت خرید"}
        </Button>

        {expense && (
          <Button type="button" variant="ghost" onClick={onDelete} disabled={isPending}>
            <Trash size={16} />
            حذف خرید
          </Button>
        )}
      </form>
    </BottomSheet>
  );
}
