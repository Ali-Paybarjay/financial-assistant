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
import { Field, FormError } from "@/components/field";
import { CURRENCIES, currencySymbol, type CurrencyCode } from "@/lib/money";
import type { DongGroupWithTotals } from "@/lib/queries/dong";
import { dongGroupFormSchema, type DongGroupForm } from "@/lib/validation/dong";
import { deleteDongGroup, saveDongGroup } from "./actions";

export function GroupSheet({
  open,
  onOpenChange,
  group,
  defaultCurrency,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DongGroupWithTotals | null;
  defaultCurrency: CurrencyCode;
  today: string;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DongGroupForm>({
    resolver: zodResolver(dongGroupFormSchema),
    defaultValues: {
      title: "",
      currency: defaultCurrency,
      startedOn: today,
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      group
        ? {
            title: group.title,
            currency: group.currency,
            startedOn: group.started_on,
            note: group.note ?? "",
          }
        : { title: "", currency: defaultCurrency, startedOn: today, note: "" },
    );
    setFormError(undefined);
    setConfirmingDelete(false);
  }, [open, group, defaultCurrency, today, reset]);

  function onSubmit(values: DongGroupForm) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveDongGroup({ ...values, id: group?.id });
      if ("error" in result) setFormError(result.error);
      else {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  function onDelete() {
    if (!group) return;
    setFormError(undefined);
    startTransition(async () => {
      const result = await deleteDongGroup(group.id);
      if ("error" in result) setFormError(result.error);
      else {
        onOpenChange(false);
        // The group's own page is gone with it, so there is nowhere to refresh
        // back to but the list.
        router.push("/dong");
      }
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={group ? "ویرایش دوره" : "دوره‌ی تازه"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        <Field label="اسم دوره" htmlFor="group-title" error={errors.title?.message}>
          <Input id="group-title" placeholder="مثلاً سفر شمال" {...register("title")} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="واحد پول"
            htmlFor="group-currency"
            hint={group ? undefined : "بعداً هم عوض می‌شود."}
          >
            <NativeSelect
              id="group-currency"
              disabled={Boolean(group && group.expenseCount > 0)}
              {...register("currency")}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code} · {currencySymbol(code)}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field
            label="از چه تاریخی"
            htmlFor="group-started"
            error={errors.startedOn?.message}
          >
            <Input id="group-started" type="date" dir="ltr" {...register("startedOn")} />
          </Field>
        </div>

        {group && group.expenseCount > 0 && (
          <p className="rounded-control border border-dashed border-hairline-strong bg-paper px-3 py-2.5 text-caption text-ink-muted">
            واحد پول بعد از ثبت اولین خرید قفل می‌شود: عوض‌کردنش مبلغ‌های ثبت‌شده را
            بی‌آنکه دست بخورند، معنای دیگری می‌داد.
          </p>
        )}

        <Field label="توضیح" htmlFor="group-note">
          <Input id="group-note" placeholder="اختیاری" {...register("note")} />
        </Field>

        <Button type="submit" size="lg" disabled={isPending}>
          {group ? "ذخیره" : "بساز"}
        </Button>

        {group && !confirmingDelete && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmingDelete(true)}
            disabled={isPending}
          >
            <Trash size={16} />
            حذف دوره
          </Button>
        )}

        {group && confirmingDelete && (
          <div className="flex flex-col gap-2 rounded-control border border-negative/25 bg-negative-tint p-3">
            <p className="text-caption font-medium text-negative">
              با حذف این دوره، آدم‌ها، خریدها و پرداخت‌هایش هم پاک می‌شوند. برگشتی
              ندارد.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={onDelete}
                disabled={isPending}
              >
                حذفش کن
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmingDelete(false)}
                disabled={isPending}
              >
                بی‌خیال
              </Button>
            </div>
          </div>
        )}
      </form>
    </BottomSheet>
  );
}
