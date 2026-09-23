"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowsClockwise,
  Bank,
  CaretLeft,
  Coins,
  CreditCard,
  ListChecks,
  Palette,
  Plus,
  SignOut,
  SquaresFour,
  Target,
  Trash,
  UserCircle,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { useIsGuest } from "@/components/guest/guest-provider";
import { GuestSignOutSheet, useSignOut } from "@/components/sign-out";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { Switch } from "@/components/ui/switch";
import { Field, FormError } from "@/components/field";
import { CURRENCIES, type CurrencyCode } from "@/lib/money";
import {
  COUNTRIES,
  CURRENCY_LABELS,
  EMPLOYMENT_OPTIONS,
  RISK_LABELS,
  type StepMeta,
} from "@/lib/onboarding/config";
import {
  profileFormSchema,
  type ProfileFormInput,
  type ProfileFormOutput,
} from "@/lib/validation/onboarding";
import { cn } from "@/lib/utils";
import type { CategoryRow, ProfileRow } from "@/lib/supabase/database.types";
import {
  deleteAccount,
  deleteCategory,
  resetRiskAnswers,
  saveCategory,
  setDefaultWorkspace,
  updateCurrency,
  updateProfile,
} from "./actions";

type Sheet = "profile" | "currency" | "categories" | "delete" | null;

export function SettingsView({
  profile,
  email,
  currency,
  categories,
  missingSteps,
}: {
  profile: ProfileRow;
  email: string | null;
  currency: CurrencyCode;
  categories: CategoryRow[];
  missingSteps: StepMeta[];
}) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const isGuest = useIsGuest();
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

      <GuestCard />
      <CompleteProfileCard steps={missingSteps} />

      <button
        type="button"
        onClick={() => setSheet("profile")}
        className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface p-4 text-start hover:border-hairline-strong"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-action-tint text-[18px] font-semibold text-action">
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
        <Row href="/accounts" icon={<CreditCard size={20} />} label="حساب‌ها" />
        <Row href="/income" icon={<Coins size={20} />} label="منابع درآمد" />
        <Row
          href="/income?tab=recurring"
          icon={<ArrowsClockwise size={20} />}
          label="هزینه‌های ثابت"
        />
        <Row href="/goals" icon={<Target size={20} />} label="هدف‌ها" />
        <Row href="/import" icon={<Bank size={20} />} label="صورت‌حساب بانکی" />
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

      <Group title="شروع">
        <StartRow current={profile.default_workspace} />
      </Group>

      <Group title="ظاهر">
        <Row href="/settings/appearance" icon={<Palette size={20} />} label="تم روشن و تیره" />
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
          <UserCircle size={20} className="text-action" />
          <span className="flex-1 text-[14px] text-ink">ایمیل</span>
          <span dir="ltr" className="truncate text-caption text-ink-muted">
            {isGuest ? "—" : email}
          </span>
        </div>
        <SignOutRow />
        {/* A guest has no separate "delete account": signing out already does
            it, and offering both would suggest one of them keeps the data. */}
        {!isGuest && (
          <button
            type="button"
            onClick={() => setSheet("delete")}
            className="flex h-14 w-full items-center gap-3 px-4 text-start hover:bg-paper"
          >
            <Trash size={20} className="text-negative" />
            <span className="flex-1 text-[14px] text-negative">حذف حساب</span>
          </button>
        )}
      </Group>

      {!isGuest && (
        <p className="mt-2 px-1 text-caption text-ink-muted">
          حذف حساب برگشت‌پذیر نیست و همه‌ی تراکنش‌ها، درآمدها و هدف‌هایت را پاک می‌کند.
        </p>
      )}

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
      <span className="text-action">{icon}</span>
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

/**
 * «Ask me which section every time.»
 *
 * On when nothing is remembered, which is the state a new account starts in
 * — so the switch reads as a thing you turn off rather than a setting you
 * have to find and turn on. Turning it off here would have nothing to
 * remember yet, so it only ever puts the chooser back.
 */
function StartRow({ current }: { current: "personal" | "dong" | null }) {
  const [isPending, startTransition] = useTransition();
  const asksEveryTime = current === null;

  return (
    <div className="flex h-14 w-full items-center gap-3 px-4">
      <span className="text-action">
        <SquaresFour size={20} />
      </span>
      <label htmlFor="ask-workspace" className="flex-1 text-[14px] text-ink">
        هر بار بپرس کدام بخش
      </label>
      <Switch
        id="ask-workspace"
        checked={asksEveryTime}
        disabled={isPending || asksEveryTime}
        onCheckedChange={() =>
          startTransition(async () => {
            await setDefaultWorkspace(null);
          })
        }
      />
    </div>
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
      <Target size={20} className="text-action" />
      <span className="flex-1 text-[14px] text-ink">
        {isPending ? "دارم آماده می‌کنم…" : "پاسخ دوباره به سؤال‌های ریسک"}
      </span>
      <span className="text-caption text-ink-muted">{label}</span>
      <CaretLeft size={16} className="text-ink-faint" />
    </button>
  );
}

/**
 * The standing offer, at the top of settings, for as long as the account is a
 * guest one. Between the notice on the way in and the warning on the way out,
 * this is the only place the user can come looking for it on their own — so it
 * leads with what they get, not with what they lose.
 */
function GuestCard() {
  const isGuest = useIsGuest();
  if (!isGuest) return null;

  return (
    <div className="mb-4 rounded-card border border-guess-border bg-guess-tint p-4">
      <div className="flex items-center gap-2">
        <Warning size={18} weight="fill" className="shrink-0 text-guess" />
        <h2 className="text-[15px] font-semibold text-ink">حساب مهمان</h2>
      </div>
      <p className="mt-1.5 text-caption text-guess-text">
        این حساب ایمیل ندارد، پس با خروج پاک می‌شود و راهی برای
        برگشتن نداری. یک ایمیل و رمز بگذار تا همه‌چیز بماند — چیزی از نو
        شروع نمی‌شود.
      </p>
      <Button asChild size="default" className="mt-3 w-full">
        <Link href="/save-account">ذخیره‌ی اطلاعات و ساخت حساب</Link>
      </Button>
    </div>
  );
}

/**
 * The standing invitation to finish what onboarding let them skip.
 *
 * Judged on the data rather than on how far they got, so it names exactly
 * what is empty and goes away on its own once nothing is. It leads with what
 * they get — a better answer — and never with what they failed to do:
 * skipping was offered as a first-class choice, and this is not the place to
 * take that back.
 */
function CompleteProfileCard({ steps }: { steps: StepMeta[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="mb-4 rounded-card border border-action-tint-edge bg-action-tint p-4">
      <div className="flex items-center gap-2">
        <ListChecks size={18} weight="fill" className="shrink-0 text-action" />
        <h2 className="text-[15px] font-semibold text-ink">تصویر مالی‌ات هنوز کامل نیست</h2>
      </div>
      <p className="mt-1.5 text-caption text-ink-muted">
        هرچه بیشتر از وضعیتت بدانم، دقیق‌تر می‌توانم بگویم آخر ماه چقدر برایت می‌ماند.
        هر وقت خواستی، از همین‌جا ادامه بده.
      </p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {steps.map((step) => (
          <li
            key={step.step}
            className="inline-flex h-7 items-center rounded-full bg-surface px-2.5 text-caption font-medium text-ink-muted"
          >
            {step.kicker}
          </li>
        ))}
      </ul>
      <Button asChild size="default" className="mt-3 w-full">
        <Link href={`/onboarding/${steps[0].step}`}>تکمیل اطلاعات</Link>
      </Button>
    </div>
  );
}

function SignOutRow() {
  const isGuest = useIsGuest();
  const [confirming, setConfirming] = useState(false);
  const { signOut, isPending } = useSignOut();

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => (isGuest ? setConfirming(true) : signOut())}
        className="flex h-14 w-full items-center gap-3 px-4 text-start hover:bg-paper disabled:opacity-50"
      >
        <SignOut size={20} className={isGuest ? "text-negative" : "text-ink-muted"} />
        <span className={cn("flex-1 text-[14px]", isGuest ? "text-negative" : "text-ink")}>
          {isPending
            ? "دارم خارجت می‌کنم…"
            : isGuest
              ? "خروج و حذف اطلاعات"
              : "خروج از حساب"}
        </span>
      </button>

      {/* Signing out of a real account is undoable by signing back in; signing
          out of a guest one is not, so it gets a confirmation the same way
          deleting an account does. */}
      <GuestSignOutSheet
        open={confirming}
        onOpenChange={(next) => !next && setConfirming(false)}
        isPending={isPending}
        onConfirm={signOut}
      />
    </>
  );
}

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
  } = useForm<ProfileFormInput, unknown, ProfileFormOutput>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: profile.full_name ?? "",
      countryCode: (profile.country_code as ProfileFormInput["countryCode"]) ?? "CA",
      // "" is what an unanswered optional field looks like to the DOM; the
      // form schema turns it back into null. A made-up 1990 would be an answer.
      birthYear: profile.birth_year ?? "",
      employmentStatus: profile.employment_status ?? "",
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

        <Field label="سال تولد" htmlFor="s-birth" optional error={errors.birthYear?.message}>
          <Input
            id="s-birth"
            dir="ltr"
            inputMode="numeric"
            className="tabular-nums"
            {...register("birthYear")}
          />
        </Field>

        <Field label="وضعیت اشتغال" htmlFor="s-employment" optional>
          <NativeSelect id="s-employment" {...register("employmentStatus")}>
            <option value="">بعداً می‌گویم</option>
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
