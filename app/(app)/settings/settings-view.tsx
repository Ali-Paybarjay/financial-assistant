"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowsClockwise,
  CaretLeft,
  Coins,
  Plus,
  SignOut,
  SquaresFour,
  Target,
  Trash,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { Field, FormError } from "@/components/field";
import { CURRENCIES, type CurrencyCode } from "@/lib/money";
import {
  COUNTRIES,
  CURRENCY_LABELS,
  EMPLOYMENT_OPTIONS,
  RISK_LABELS,
} from "@/lib/onboarding/config";
import type { CategoryRow, ProfileRow } from "@/lib/supabase/database.types";
import { logout } from "@/app/(auth)/actions";
import {
  deleteAccount,
  deleteCategory,
  resetRiskAnswers,
  saveCategory,
  updateCurrency,
  updateProfile,
} from "./actions";

type Sheet = "profile" | "currency" | "categories" | "delete" | null;

export function SettingsView({
  profile,
  email,
  currency,
  categories,
}: {
  profile: ProfileRow;
  email: string | null;
  currency: CurrencyCode;
  categories: CategoryRow[];
}) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const country = COUNTRIES.find((entry) => entry.code === profile.country_code);

  const subtitle = [
    country?.name,
    currency,
    profile.risk_label ? RISK_LABELS[profile.risk_label] : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-4">
      <h1 className="mb-4 text-title font-semibold text-ink">تنظیمات</h1>

      <button
        type="button"
        onClick={() => setSheet("profile")}
        className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface p-4 text-start hover:border-hairline-strong"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-lapis-tint text-[18px] font-semibold text-lapis">
          {(profile.full_name ?? "؟").trim().charAt(0)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[17px] font-semibold text-ink">
            {profile.full_name ?? "حساب من"}
          </span>
          <span className="truncate text-caption text-ink-muted">{subtitle}</span>
        </span>
        <CaretLeft size={16} className="text-ink-faint" />
      </button>

      <Group title="پول">
        <Row href="/income" icon={<Coins size={20} />} label="منابع درآمد" />
        <Row
          href="/income?tab=recurring"
          icon={<ArrowsClockwise size={20} />}
          label="هزینه‌های ثابت"
        />
        <Row href="/goals" icon={<Target size={20} />} label="هدف‌ها" />
        <Row
          onClick={() => setSheet("categories")}
          icon={<SquaresFour size={20} />}
          label="دسته‌ها"
          value={`${categories.filter((c) => !c.is_system).length || ""}`}
        />
        <Row
          onClick={() => setSheet("currency")}
          icon={<Coins size={20} />}
          label="ارز پایه"
          value={CURRENCY_LABELS[currency]}
        />
      </Group>

      <Group title="پروفایل">
        <Row
          onClick={() => setSheet("profile")}
          icon={<UserCircle size={20} />}
          label="نام، کشور، سال تولد"
        />
        <RiskRow label={profile.risk_label ? RISK_LABELS[profile.risk_label] : "پاسخ نداده‌ای"} />
      </Group>

      <Group title="حساب">
        <div className="flex h-14 items-center gap-3 px-4">
          <UserCircle size={20} className="text-lapis" />
          <span className="flex-1 text-[14px] text-ink">ایمیل</span>
          <span dir="ltr" className="truncate text-caption text-ink-muted">
            {email}
          </span>
        </div>
        <SignOutRow />
        <button
          type="button"
          onClick={() => setSheet("delete")}
          className="flex h-14 w-full items-center gap-3 px-4 text-start hover:bg-paper"
        >
          <Trash size={20} className="text-negative" />
          <span className="flex-1 text-[14px] text-negative">حذف حساب</span>
        </button>
      </Group>

      <p className="mt-2 px-1 text-caption text-ink-muted">
        حذف حساب برگشت‌پذیر نیست و همه‌ی تراکنش‌ها، درآمدها و هدف‌هایت را پاک می‌کند.
      </p>

      <ProfileSheet
        open={sheet === "profile"}
        onClose={() => setSheet(null)}
        profile={profile}
      />
      <CurrencySheet
        open={sheet === "currency"}
        onClose={() => setSheet(null)}
        current={currency}
      />
      <CategoriesSheet
        open={sheet === "categories"}
        onClose={() => setSheet(null)}
        categories={categories}
      />
      <DeleteAccountSheet
        open={sheet === "delete"}
        onClose={() => setSheet(null)}
        name={profile.full_name ?? ""}
      />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="mb-1.5 mt-5 text-caption font-semibold text-ink-muted">{title}</h2>
      <div className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface">
        {children}
      </div>
    </>
  );
}

function Row({
  href,
  onClick,
  icon,
  label,
  value,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  const body = (
    <>
      <span className="text-lapis">{icon}</span>
      <span className="flex-1 text-[14px] text-ink">{label}</span>
      {value && <span className="text-caption text-ink-muted">{value}</span>}
      <CaretLeft size={16} className="text-ink-faint" />
    </>
  );

  const className =
    "flex h-14 w-full items-center gap-3 px-4 text-start hover:bg-paper";

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

function RiskRow({ label }: { label: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => resetRiskAnswers())}
      className="flex h-14 w-full items-center gap-3 px-4 text-start hover:bg-paper disabled:opacity-50"
    >
      <Target size={20} className="text-lapis" />
      <span className="flex-1 text-[14px] text-ink">
        {isPending ? "دارم آماده می‌کنم…" : "پاسخ دوباره به سؤال‌های ریسک"}
      </span>
      <span className="text-caption text-ink-muted">{label}</span>
      <CaretLeft size={16} className="text-ink-faint" />
    </button>
  );
}

function SignOutRow() {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          // Clear the client cache before the session goes, so the next account
          // on this device never sees the previous one's numbers.
          queryClient.clear();
          return logout();
        })
      }
      className="flex h-14 w-full items-center gap-3 px-4 text-start hover:bg-paper disabled:opacity-50"
    >
      <SignOut size={20} className="text-ink-muted" />
      <span className="flex-1 text-[14px] text-ink">
        {isPending ? "دارم خارجت می‌کنم…" : "خروج از حساب"}
      </span>
    </button>
  );
}

const profileFormSchema = z.object({
  fullName: z.string().trim().min(2, "نامت را بنویس").max(80),
  countryCode: z.enum(COUNTRIES.map((country) => country.code)),
  birthYear: z.number().int().min(1930).max(new Date().getFullYear() - 13),
  employmentStatus: z.enum(EMPLOYMENT_OPTIONS.map((option) => option.value)),
});
type ProfileForm = z.infer<typeof profileFormSchema>;

function ProfileSheet({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: ProfileRow;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: profile.full_name ?? "",
      countryCode: (profile.country_code as ProfileForm["countryCode"]) ?? "CA",
      birthYear: profile.birth_year ?? 1990,
      employmentStatus:
        (profile.employment_status as ProfileForm["employmentStatus"]) ?? "employed",
    },
  });

  return (
    <BottomSheet open={open} onOpenChange={(next) => !next && onClose()} title="پروفایل">
      <form
        onSubmit={handleSubmit((values) =>
          startTransition(async () => {
            const result = await updateProfile(values);
            if ("error" in result) setError(result.error);
            else {
              onClose();
              router.refresh();
            }
          }),
        )}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormError>{error}</FormError>

        <Field label="نام" htmlFor="s-name" error={errors.fullName?.message}>
          <Input id="s-name" {...register("fullName")} />
        </Field>

        <Field label="کشور محل زندگی" htmlFor="s-country">
          <NativeSelect id="s-country" {...register("countryCode")}>
            {COUNTRIES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.flag} {entry.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="سال تولد" htmlFor="s-birth" error={errors.birthYear?.message}>
          <Input
            id="s-birth"
            dir="ltr"
            inputMode="numeric"
            className="tabular-nums"
            {...register("birthYear", { valueAsNumber: true })}
          />
        </Field>

        <Field label="وضعیت اشتغال" htmlFor="s-employment">
          <NativeSelect id="s-employment" {...register("employmentStatus")}>
            {EMPLOYMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "دارم ذخیره می‌کنم…" : "ذخیره"}
        </Button>
      </form>
    </BottomSheet>
  );
}

function CurrencySheet({
  open,
  onClose,
  current,
}: {
  open: boolean;
  onClose: () => void;
  current: CurrencyCode;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<CurrencyCode>(current);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="ارز پایه"
    >
      <div className="flex flex-col gap-4">
        <FormError>{error}</FormError>

        {/* Stated before the tap, not after it. */}
        <p className="flex items-start gap-2 rounded-control border border-guess-border bg-guess-tint px-3 py-2.5 text-caption font-medium text-guess-text">
          <WarningCircle size={16} className="mt-0.5 shrink-0" />
          مبالغ قبلی تبدیل نمی‌شوند و با ارز قدیم می‌مانند.
        </p>

        <NativeSelect
          aria-label="ارز پایه"
          value={choice}
          onChange={(event) => setChoice(event.target.value as CurrencyCode)}
        >
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {CURRENCY_LABELS[code]} ({code})
            </option>
          ))}
        </NativeSelect>

        <Button
          size="lg"
          disabled={isPending || choice === current}
          onClick={() =>
            startTransition(async () => {
              const result = await updateCurrency(choice);
              if ("error" in result) setError(result.error);
              else {
                onClose();
                router.refresh();
              }
            })
          }
        >
          {isPending ? "دارم عوض می‌کنم…" : "عوضش کن"}
        </Button>
      </div>
    </BottomSheet>
  );
}

function CategoriesSheet({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const own = categories.filter((category) => !category.is_system);

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="دسته‌ها"
      description="دسته‌های سیستمی قابل حذف نیستند."
    >
      <div className="flex flex-col gap-4">
        <FormError>{error}</FormError>

        {own.length > 0 && (
          <ul className="divide-y divide-hairline overflow-hidden rounded-control border border-hairline">
            {own.map((category) => (
              <li key={category.id} className="flex h-12 items-center gap-2 px-3">
                <span className="flex-1 truncate text-[14px] text-ink">
                  {category.name_fa}
                </span>
                <span className="text-caption text-ink-muted">
                  {category.kind === "income" ? "درآمد" : "هزینه"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`حذف ${category.name_fa}`}
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteCategory(category.id);
                      router.refresh();
                    })
                  }
                >
                  <Trash size={15} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <Field label="دسته‌ی تازه" htmlFor="new-category" className="flex-1">
            <Input
              id="new-category"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثلاً باشگاه"
            />
          </Field>
          <NativeSelect
            aria-label="نوع دسته"
            className="w-28"
            value={kind}
            onChange={(event) => setKind(event.target.value as "expense" | "income")}
          >
            <option value="expense">هزینه</option>
            <option value="income">درآمد</option>
          </NativeSelect>
        </div>

        <Button
          size="lg"
          disabled={isPending || name.trim().length === 0}
          onClick={() =>
            startTransition(async () => {
              const result = await saveCategory({ nameFa: name, kind });
              if ("error" in result) setError(result.error);
              else {
                setName("");
                router.refresh();
              }
            })
          }
        >
          <Plus size={18} />
          {isPending ? "دارم می‌سازم…" : "بساز"}
        </Button>

        <p className="text-caption text-ink-muted">
          حذف یک دسته، تراکنش‌هایش را پاک نمی‌کند — فقط دسته‌شان خالی می‌شود.
        </p>
      </div>
    </BottomSheet>
  );
}

function DeleteAccountSheet({
  open,
  onClose,
  name,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="حذف حساب"
    >
      <div className="flex flex-col gap-4">
        <FormError>{error}</FormError>

        <p className="rounded-control border border-negative/25 bg-negative-tint px-3 py-2.5 text-caption font-medium text-negative">
          این کار برگشت‌پذیر نیست. همه‌ی تراکنش‌ها، درآمدها، هزینه‌های ثابت و هدف‌هایت
          همین حالا پاک می‌شوند.
        </p>

        <Field
          label={`برای تأیید، «${name}» را تایپ کن`}
          htmlFor="delete-confirm"
        >
          <Input
            id="delete-confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
          />
        </Field>

        <Button
          variant="destructive"
          size="lg"
          disabled={isPending || typed.trim() !== name.trim()}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteAccount(typed);
              if (result && "error" in result) setError(result.error);
            })
          }
        >
          {isPending ? "دارم حذف می‌کنم…" : "حساب را حذف کن"}
        </Button>
      </div>
    </BottomSheet>
  );
}
