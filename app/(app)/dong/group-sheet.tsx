"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { Field, FormError } from "@/components/field";
import { AccountField } from "@/components/accounts/account-field";
import { CURRENCIES, currencySymbol, type CurrencyCode } from "@/lib/money";
import type { AccountRow } from "@/lib/supabase/database.types";
import type { DongGroupWithTotals } from "@/lib/queries/dong";
import { dongGroupFormSchema, type DongGroupForm } from "@/lib/validation/dong";
import { deleteDongGroup, saveDongGroup } from "./actions";

export function GroupSheet({
  open,
  onOpenChange,
  group,
  accounts,
  defaultCurrency,
  defaultAccountId,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DongGroupWithTotals | null;
  /** The viewer's own accounts, for the one this trip is run out of. */
  accounts: AccountRow[];
  defaultCurrency: CurrencyCode;
  /** Their usual account, so the common answer is already filled in. */
  defaultAccountId: string | null;
  today: string;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DongGroupForm>({
    resolver: zodResolver(dongGroupFormSchema),
    defaultValues: {
      title: "",
      currency: defaultCurrency,
      accountId: defaultAccountId ?? "",
      startedOn: today,
      note: "",
    },
  });

  // Watched, not read once: the account list below is the accounts in the
  // group's currency, and the currency is a control on this same form.
  const currency = (useWatch({ control, name: "currency" }) ??
    defaultCurrency) as CurrencyCode;
  const usable = accounts.filter((account) => account.currency === currency);
  const locked = Boolean(group && (group.expenseCount > 0 || group.paymentCount > 0));

  const accountId = useWatch({ control, name: "accountId" });

  /**
   * Switching the currency takes the account with it. Without this the field
   * simply disappears — there are no accounts in the new currency to list —
   * while still holding the old answer, and the save fails on a rule about a
   * control the user cannot see.
   */
  useEffect(() => {
    if (accountId && !usable.some((account) => account.id === accountId)) {
      setValue("accountId", "");
    }
  }, [accountId, usable, setValue]);

  useEffect(() => {
    if (!open) return;
    reset(
      group
        ? {
            title: group.title,
            currency: group.currency,
            accountId: group.account_id ?? "",
            startedOn: group.started_on,
            note: group.note ?? "",
          }
        : {
            title: "",
            currency: defaultCurrency,
            accountId: defaultAccountId ?? "",
            startedOn: today,
            note: "",
          },
    );
    setFormError(undefined);
    setConfirmingDelete(false);
  }, [open, group, defaultCurrency, defaultAccountId, today, reset]);

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
            <NativeSelect id="group-currency" disabled={locked} {...register("currency")}>
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

        {locked && (
          <p className="rounded-well border border-dashed border-hairline-strong/45 bg-paper px-3 py-2.5 text-caption text-ink-muted">
            واحد پول بعد از اولین ثبت قفل می‌شود: عوض‌کردنش مبلغ‌های ثبت‌شده را
            بی‌آنکه دست بخورند، معنای دیگری می‌داد.
          </p>
        )}

        {/* The question the whole «از کدام حسابت» flow hangs on, asked once
            and here — at the start of the trip, when the user knows the
            answer — so that every purchase afterwards is one tap. */}
        <AccountField
          id="group-account"
          label="از کدام حسابت"
          accounts={usable}
          selectedId={group?.account_id}
          hint="هر خریدی که خودت پولش را بدهی، از همین حساب کم می‌شود و در حسابداری شخصی‌ات ثبت می‌شود. بعداً روی هر خرید هم می‌شود عوضش کرد."
          {...register("accountId")}
        />

        {usable.length === 0 && accounts.length > 0 && (
          <p className="rounded-well border border-dashed border-hairline-strong/45 bg-paper px-3 py-2.5 text-caption text-ink-muted">
            هیچ حسابی به {currency} نداری، پس این دوره به حسابداری
            شخصی وصل نمی‌شود. این اپ نرخ تبدیل ندارد و نمی‌خواهد از خودش درآورد.
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
