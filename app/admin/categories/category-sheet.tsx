"use client";

import { useState, useTransition } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { SegmentedControl } from "@/components/segmented-control";
import { BottomSheet } from "@/components/bottom-sheet";
import { faNumber } from "@/lib/format";
import { deleteSystemCategory, saveSystemCategory } from "@/lib/admin/actions";
import type { CostKind } from "@/lib/supabase/database.types";

/**
 * Editing a category every user shares.
 *
 * The sheet says what the edit reaches, because it reaches further than the page
 * suggests: the name appears on every user's composer *and* inside the model's
 * prompt, so a rename changes what the model is asked to choose between.
 *
 * `cost_kind` carries its own warning. Turning a variable category fixed leaves
 * every ceiling anyone had set on it in place but unread — migration 0026 deletes
 * such rows when it runs, and nothing deletes them afterwards. That is a real
 * consequence with no visible symptom, which is exactly the kind that has to be
 * said out loud before the tap rather than discovered later.
 *
 * slug and kind are fixed after creation: the code references slugs as string
 * literals, so a slug that can move is a slug that can break an import path.
 */

export type EditableCategory = {
  id: string;
  name_fa: string;
  slug: string;
  kind: "expense" | "income";
  cost_kind: CostKind;
  sort_order: number;
  /** Total references across the five tables that point at a category. */
  usageTotal: number;
  protected: boolean;
};

export function CategorySheet({
  category,
  onDone,
}: {
  /** null opens the sheet for a new system category. */
  category: EditableCategory | null;
  onDone: () => void;
}) {
  const [nameFa, setNameFa] = useState(category?.name_fa ?? "");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [costKind, setCostKind] = useState<CostKind>(category?.cost_kind ?? "variable");
  const [sortOrder, setSortOrder] = useState(String(category?.sort_order ?? 100));
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const creating = category === null;
  const becomingFixed = !creating && category.cost_kind === "variable" && costKind === "fixed";

  const save = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveSystemCategory({
        id: category?.id,
        nameFa,
        sortOrder: Number(sortOrder) || 0,
        costKind,
        ...(creating ? { slug, kind } : {}),
      });
      if ("error" in result) setError(result.error);
      else onDone();
    });
  };

  return (
    <BottomSheet
      open
      onOpenChange={(next) => !next && onDone()}
      title={creating ? "دستهٔ سیستمی تازه" : category.name_fa}
      description={
        creating
          ? "روی نوار ثبت هر کاربر و در پرامپت مدل ظاهر می‌شود."
          : "نامی که این‌جا می‌نویسی روی نوار ثبت هر کاربر و در پرامپت مدل دیده می‌شود."
      }
    >
      <div className="flex flex-col gap-3">
        <FormError>{error}</FormError>

        <Field label="نام فارسی" htmlFor="cat-name">
          <Input
            id="cat-name"
            value={nameFa}
            maxLength={40}
            onChange={(event) => setNameFa(event.target.value)}
          />
        </Field>

        {creating ? (
          <>
            <Field
              label="slug"
              htmlFor="cat-slug"
              hint="حروف کوچک انگلیسی، رقم و خط تیره. بعد از ساخت عوض نمی‌شود."
            >
              <Input
                id="cat-slug"
                dir="ltr"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </Field>

            <Field label="نوع" htmlFor="cat-kind" hint="بعد از ساخت عوض نمی‌شود.">
              <NativeSelect
                id="cat-kind"
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as "expense" | "income")
                }
              >
                <option value="expense">هزینه</option>
                <option value="income">درآمد</option>
              </NativeSelect>
            </Field>
          </>
        ) : (
          <Field label="slug" htmlFor="cat-slug-fixed" hint="عوض نمی‌شود — کد به آن ارجاع می‌دهد.">
            <Input id="cat-slug-fixed" dir="ltr" value={category.slug} disabled />
          </Field>
        )}

        {/* Not a <Field>: that renders a <label htmlFor>, and a segmented
            control is a tablist with no single labellable input to point at.
            It carries its own aria-label instead. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-ink-muted">ماهیت هزینه</span>
          <SegmentedControl<CostKind>
            label="ماهیت هزینه"
            value={costKind}
            onChange={setCostKind}
            segments={[
              { value: "variable", label: "متغیر" },
              { value: "fixed", label: "ثابت" },
            ]}
          />
          <p className="text-caption text-ink-muted">
            «ثابت» یعنی مبلغ و تاریخش را کسی دیگر تعیین کرده، پس سقف نمی‌گیرد.
          </p>
        </div>

        {becomingFixed && (
          <p className="rounded-control border border-guess-border bg-guess-tint px-3 py-2 text-caption font-medium text-guess-text">
            سقف‌هایی که کاربران روی این دسته گذاشته‌اند بی‌صدا نادیده گرفته می‌شوند —
            نه پاک، نه خوانده.
          </p>
        )}

        <Field label="ترتیب" htmlFor="cat-order" hint="عدد کوچک‌تر بالاتر می‌نشیند.">
          <Input
            id="cat-order"
            type="number"
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </Field>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="flex-1"
            disabled={isPending}
            onClick={onDone}
          >
            بیخیال
          </Button>
          <Button
            type="button"
            size="lg"
            className="flex-1"
            disabled={isPending || nameFa.trim().length === 0}
            onClick={save}
          >
            {isPending ? "دارم ذخیره می‌کنم…" : "ذخیره"}
          </Button>
        </div>

        {!creating && <DeleteRow category={category} onDone={onDone} />}
      </div>
    </BottomSheet>
  );
}

/**
 * Delete, and the reason it is usually refused.
 *
 * Two separate reasons, said separately: the code names this slug, or somebody's
 * data points at it. «Rename it instead» is the advice in both cases, and it is
 * on the button's own line rather than in a toast after the attempt.
 */
function DeleteRow({
  category,
  onDone,
}: {
  category: EditableCategory;
  onDone: () => void;
}) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const blocked = category.protected
    ? "کد به این دسته با نام ارجاع می‌دهد."
    : category.usageTotal > 0
      ? `${faNumber(category.usageTotal)} ردیف به آن اشاره می‌کند.`
      : null;

  return (
    <div className="mt-2 border-t border-hairline pt-3">
      <FormError>{error}</FormError>
      {blocked ? (
        <p className="text-caption text-ink-muted">
          حذف نمی‌شود: {blocked} اسمش را عوض کن.
        </p>
      ) : (
        <Button
          type="button"
          variant="destructive"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteSystemCategory(category.id);
              if ("error" in result) setError(result.error);
              else onDone();
            })
          }
        >
          {isPending ? "دارم حذف می‌کنم…" : "حذف این دسته"}
        </Button>
      )}
    </div>
  );
}

/** The «add» button, so the page stays a server component. */
export function NewCategoryButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onOpen}>
      <Plus size={16} />
      دستهٔ تازه
    </Button>
  );
}
