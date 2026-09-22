"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDown,
  CaretDown,
  CaretUp,
  CheckCircle,
  Flag,
  Plus,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { AmountInput } from "@/components/amount-input";
import { Field, FormError } from "@/components/field";
import { Money } from "@/components/money";
import { faPercent } from "@/lib/format";
import { formatDateFa } from "@/lib/date";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { GOAL_TYPE_OPTIONS } from "@/lib/onboarding/config";
import { goalFormSchema, type GoalForm } from "@/lib/validation/records";
import type { MonthlySurplus } from "@/lib/cashflow";
import type { AccountWithBalance } from "@/lib/accounts";
import {
  checkSavings,
  type GoalPlan,
  type GoalWithProgress,
  type SavingsPlan,
} from "@/lib/goals";
import { deleteGoal, reorderGoal, saveGoal, setGoalStatus } from "./actions";
import { GoalPlanLine } from "./goal-plan-line";
import { PlanCard } from "./plan-card";
import { FundGoalSheet } from "./fund-sheet";
import { SavingsCheckNote } from "./savings-check";

function amountText(minor: number, currency: CurrencyCode): string {
  return formatMoney(minor, currency, { omitSymbol: true }).replace(/,/g, "");
}

export function GoalsView({
  currency,
  plan,
  surplus,
  today,
  fundedThisMonth,
  accounts,
  savingsAccounts,
  savingsTotal,
  goalsHeld,
  defaultFromAccountId,
}: {
  currency: CurrencyCode;
  plan: SavingsPlan;
  surplus: MonthlySurplus;
  today: string;
  /** Goal id -> what has already been moved into savings for it this month. */
  fundedThisMonth: Record<string, number>;
  accounts: AccountWithBalance[];
  savingsAccounts: AccountWithBalance[];
  /** What the savings accounts hold, against what the goals claim to hold. */
  savingsTotal: number;
  goalsHeld: number;
  defaultFromAccountId: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<GoalWithProgress | null>(null);
  const [open, setOpen] = useState(false);
  const [funding, setFunding] = useState<GoalPlan | null>(null);
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  // A goal waiting its turn is waiting for whichever undated goal took the
  // money left after the deadlines — there is at most one, and naming it beats
  // «در نوبت». A dated goal ahead of it is not what is holding it up: it took
  // only what its own date costs, and would have taken that anyway.
  const takingTheLeftover = plan.goals.find((row) => row.standing === "undated")?.goal;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GoalForm>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      title: "",
      type: "emergency_fund",
      targetAmount: "",
      savedAmount: "",
      targetDate: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            title: editing.title,
            type: editing.type as GoalForm["type"],
            targetAmount: amountText(editing.target_amount, currency),
            savedAmount: amountText(editing.opening_saved, currency),
            targetDate: editing.target_date ?? "",
          }
        : {
            title: "",
            type: "emergency_fund",
            targetAmount: "",
            savedAmount: "",
            targetDate: "",
          },
    );
    setFormError(undefined);
  }, [open, editing, currency, reset]);

  function onSubmit(values: GoalForm) {
    startTransition(async () => {
      // The id belongs to the row being edited, not to the form. A hidden
      // input hands back "" for a new record, "" is not a uuid, and nothing
      // renders errors.id — so the submit became a silent no-op.
      const result = await saveGoal({ ...values, id: editing?.id });
      if ("error" in result) setFormError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  function move(id: string, direction: -1 | 1) {
    startTransition(async () => {
      await reorderGoal(id, direction);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-4">
      <h1 className="mb-4 text-title font-semibold text-ink">هدف‌ها</h1>

      {plan.goals.length === 0 ? (
        <p className="rounded-card border border-hairline bg-surface p-6 text-center text-body text-ink-muted">
          هنوز هدفی نداری. یک هدف بساز تا بگویم ماهی چقدر باید بگذاری کنار.
        </p>
      ) : (
        <>
          <PlanCard plan={plan} surplus={surplus} currency={currency} />

          <ul className="flex flex-col gap-3">
            {plan.goals.map((row, index) => {
              const goal = row.goal;
              return (
                <li
                  key={goal.id}
                  className="flex flex-col gap-2 rounded-card border border-hairline bg-surface p-4"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(goal);
                      setOpen(true);
                    }}
                    className="flex flex-col gap-2 text-start"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
                        <Flag size={16} className="text-lapis" />
                        {goal.title}
                      </span>
                      <span className="flex items-baseline gap-1 text-caption text-ink-muted">
                        <Money minor={goal.saved} currency={currency} />
                        /
                        <Money minor={goal.target_amount} currency={currency} />
                      </span>
                    </div>

                    <div
                      role="progressbar"
                      aria-valuenow={row.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={goal.title}
                      className="h-2 overflow-hidden rounded-full bg-lapis-tint"
                    >
                      <div
                        className="h-full rounded-full bg-lapis"
                        style={{ width: `${row.progress}%` }}
                      />
                    </div>

                    <div className="flex items-baseline justify-between text-caption text-ink-muted">
                      <span>{faPercent(row.progress)} رسیده‌ای</span>
                      <span className="flex items-baseline gap-1">
                        <Money minor={row.remaining} currency={currency} />
                        مانده
                        {goal.target_date && ` تا ${formatDateFa(goal.target_date)}`}
                      </span>
                    </div>

                    {/* Money already spent on the goal is not a setback to
                        hide: it is the goal doing its job, and without saying
                        so a falling bar looks like a bug. */}
                    {goal.spent > 0 && (
                      <span className="text-caption text-ink-muted">
                        <Money minor={goal.spent} currency={currency} /> از این هدف خرج
                        شده
                      </span>
                    )}
                  </button>

                  {/* Beside the plan line rather than above it: the line is
                      two or three lines tall, so the controls cost no extra
                      height here, and the title keeps the full width. */}
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <GoalPlanLine
                        plan={row}
                        currency={currency}
                        aheadOf={
                          takingTheLeftover && takingTheLeftover.id !== goal.id
                            ? takingTheLeftover.title
                            : undefined
                        }
                      />
                    </div>

                    {/* Order decides who the month's spare money reaches
                        first, so it has to be the user's to set. */}
                    {plan.goals.length > 1 && (
                      <div className="flex shrink-0 flex-col gap-1">
                        <OrderButton
                          label={`«${goal.title}» را یک پله بالاتر ببر`}
                          disabled={index === 0 || isPending}
                          onClick={() => move(goal.id, -1)}
                        >
                          <CaretUp size={14} />
                        </OrderButton>
                        <OrderButton
                          label={`«${goal.title}» را یک پله پایین‌تر ببر`}
                          disabled={index === plan.goals.length - 1 || isPending}
                          onClick={() => move(goal.id, 1)}
                        >
                          <CaretDown size={14} />
                        </OrderButton>
                      </div>
                    )}
                  </div>

                  {/* A goal that has been reached but not closed keeps
                      sitting in the list looking unfinished. The one action it
                      needs belongs on the card, not buried in the edit sheet. */}
                  {row.standing === "done" && goal.status === "active" ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-caption text-ink-muted">
                        دیگر کاری با این هدف نداری؟
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await setGoalStatus(goal.id, "achieved");
                            router.refresh();
                          })
                        }
                      >
                        <CheckCircle size={14} />
                        تمامش کن
                      </Button>
                    </div>
                  ) : (
                    <FundingRow
                      plan={row}
                      currency={currency}
                      alreadyFunded={fundedThisMonth[goal.id] ?? 0}
                      onFund={() => setFunding(row)}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {/* After the goals, not before: you read the plan, then the goals,
              then whether the money behind them is actually there. */}
          <SavingsCheckNote
            check={checkSavings(savingsTotal, goalsHeld)}
            savingsTotal={savingsTotal}
            goalsHeld={goalsHeld}
            hasSavingsAccount={savingsAccounts.length > 0}
            currency={currency}
          />
        </>
      )}

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-4 w-full"
        onClick={() => {
          setEditing(null);
          setOpen(true);
        }}
      >
        <Plus size={18} />
        هدف تازه
      </Button>

      <FundGoalSheet
        plan={funding}
        currency={currency}
        today={today}
        accounts={accounts}
        savingsAccounts={savingsAccounts}
        defaultFromAccountId={defaultFromAccountId}
        suggested={suggestedFor(funding, fundedThisMonth)}
        onClose={() => setFunding(null)}
      />

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={editing ? "ویرایش هدف" : "هدف تازه"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormError>{formError}</FormError>

          <Field label="عنوان" htmlFor="goal-title" error={errors.title?.message}>
            <Input id="goal-title" placeholder="مثلاً سفر تابستان" {...register("title")} />
          </Field>

          <Field label="نوع" htmlFor="goal-type">
            <NativeSelect id="goal-type" {...register("type")}>
              {GOAL_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="مبلغ هدف"
              htmlFor="goal-target"
              error={errors.targetAmount?.message}
            >
              <AmountInput id="goal-target" currency={currency} {...register("targetAmount")} />
            </Field>
            <Field label="از قبل کنار گذاشته بودی" htmlFor="goal-saved">
              <AmountInput id="goal-saved" currency={currency} {...register("savedAmount")} />
            </Field>
          </div>

          <p className="-mt-1 text-caption text-ink-muted">
            «از قبل» فقط نقطه‌ی شروع است. از این به بعد، هرچه به حساب پس‌اندازت بریزی
            خودش شمرده می‌شود.
          </p>

          <Field
            label="تا چه تاریخی؟"
            htmlFor="goal-date"
            hint="خالی بگذاری، هدف بی‌تاریخ می‌ماند و هرچه از بقیه ماند به آن می‌رسد."
          >
            <Input id="goal-date" type="date" dir="ltr" {...register("targetDate")} />
          </Field>

          {/* Closing is not deleting. Deleting takes away the record of
              having reached it and unlabels every transfer that funded it;
              closing only stops it claiming a share of next month. */}
          {editing && (
            <div className="flex flex-col gap-2 rounded-control border border-hairline bg-paper p-3">
              <span className="text-caption font-medium text-ink-muted">وضعیت</span>
              <div className="flex gap-2">
                {(
                  [
                    { value: "active", label: "در جریان" },
                    { value: "paused", label: "فعلاً نه" },
                    { value: "achieved", label: "تمام شد" },
                  ] as const
                ).map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={editing.status === option.value ? "default" : "outline"}
                    disabled={isPending || editing.status === option.value}
                    onClick={() =>
                      startTransition(async () => {
                        await setGoalStatus(editing.id, option.value);
                        setOpen(false);
                        router.refresh();
                      })
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-2 flex gap-2">
            <Button type="submit" size="lg" className="flex-1" disabled={isPending}>
              {isPending ? "دارم ذخیره می‌کنم…" : "ذخیره"}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                aria-label="حذف"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteGoal(editing.id);
                    setOpen(false);
                    router.refresh();
                  })
                }
              >
                <Trash size={18} />
              </Button>
            )}
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}

/**
 * What is still to be moved for a goal this month. Already-moved money is
 * subtracted, so the sheet never opens asking a second time for an amount the
 * user has already transferred.
 */
function suggestedFor(
  plan: GoalPlan | null,
  fundedThisMonth: Record<string, number>,
): number {
  if (!plan) return 0;
  const left = plan.allocated - (fundedThisMonth[plan.goal.id] ?? 0);
  // Nothing left to move, but the user opened the sheet anyway — they mean to
  // put in extra, so start from what the plan asks for rather than from zero.
  return left > 0 ? left : plan.allocated;
}

/**
 * The ask: move this month's share into savings, and say when it is done.
 *
 * A plan that only ever states a number leaves the user to do the moving in
 * another app and remember they did. This is the one action that makes a goal
 * true — and once the month's share has moved, the row stops asking and says
 * so instead.
 */
function FundingRow({
  plan,
  currency,
  alreadyFunded,
  onFund,
}: {
  plan: GoalPlan;
  currency: CurrencyCode;
  alreadyFunded: number;
  onFund: () => void;
}) {
  if (plan.standing === "done" || plan.standing === "paused") return null;

  const outstanding = plan.allocated - alreadyFunded;

  if (alreadyFunded > 0 && outstanding <= 0) {
    return (
      <p className="flex items-center gap-1.5 text-caption font-medium text-positive">
        <CheckCircle size={14} weight="fill" />
        این ماه <Money minor={alreadyFunded} currency={currency} /> ریختی کنار.
      </p>
    );
  }

  // Nothing is allocated to it and nothing has been moved: there is no amount
  // to ask for, and a button that funds zero is worse than no button.
  if (plan.allocated <= 0) return null;

  return (
    <div className="flex items-center justify-between gap-2">
      {alreadyFunded > 0 ? (
        <span className="text-caption text-ink-muted">
          این ماه <Money minor={alreadyFunded} currency={currency} /> ریختی؛{" "}
          <Money minor={outstanding} currency={currency} /> مانده.
        </span>
      ) : (
        <span className="text-caption text-ink-muted">هنوز نریخته‌ای کنار.</span>
      )}
      <Button type="button" variant="outline" size="sm" onClick={onFund}>
        <ArrowDown size={14} />
        بریز کنار
      </Button>
    </div>
  );
}

function OrderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-control border border-hairline text-ink-muted hover:border-hairline-strong hover:text-lapis disabled:opacity-35"
    >
      {children}
    </button>
  );
}
