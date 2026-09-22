"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/field";
import type { DongMemberRow } from "@/lib/supabase/database.types";
import { dongMemberFormSchema, type DongMemberForm } from "@/lib/validation/dong";
import { deleteDongMember, saveDongMember } from "../actions";

export function MemberSheet({
  open,
  onOpenChange,
  groupId,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  member: DongMemberRow | null;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DongMemberForm>({
    resolver: zodResolver(dongMemberFormSchema),
    defaultValues: { groupId, name: "", isMe: false },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      member
        ? { groupId, name: member.name, isMe: member.is_me }
        : { groupId, name: "", isMe: false },
    );
    setFormError(undefined);
  }, [open, member, groupId, reset]);

  function onSubmit(values: DongMemberForm) {
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveDongMember({ ...values, id: member?.id });
      if ("error" in result) setFormError(result.error);
      else {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  function onDelete() {
    if (!member) return;
    setFormError(undefined);
    startTransition(async () => {
      const result = await deleteDongMember(member.id, groupId);
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
      title={member ? "ویرایش نفر" : "نفر تازه"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        <Field label="اسم" htmlFor="member-name" error={errors.name?.message}>
          <Input id="member-name" placeholder="مثلاً سارا" {...register("name")} />
        </Field>

        <label className="flex items-center gap-2.5 rounded-control border border-hairline bg-paper px-3 py-2.5">
          <input type="checkbox" className="size-4 accent-lapis" {...register("isMe")} />
          <span className="text-caption text-ink">
            این نفر خودم هستم
            <span className="mt-0.5 block text-ink-muted">
              سهم و تراز این نفر جای «تو» در صفحه‌ها نشان داده می‌شود.
            </span>
          </span>
        </label>

        <Button type="submit" size="lg" disabled={isPending}>
          {member ? "ذخیره" : "اضافه کن"}
        </Button>

        {member && (
          <Button type="button" variant="ghost" onClick={onDelete} disabled={isPending}>
            <Trash size={16} />
            حذف از دوره
          </Button>
        )}
      </form>
    </BottomSheet>
  );
}
