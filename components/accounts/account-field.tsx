"use client";

import * as React from "react";
import { NativeSelect } from "@/components/native-select";
import { Field } from "@/components/field";
import type { AccountRow } from "@/lib/supabase/database.types";

/**
 * The one control that asks "which account did this money move through".
 *
 * It renders nothing at all until the user has defined an account. Every entry
 * path shows it, and a field that is always empty and never answerable is
 * worse than no field on a form whose whole promise is ten seconds.
 *
 * Closed accounts are hidden, except the one a row is already on: a
 * transaction posted to an account that has since been closed must still show
 * where it sits, or editing anything else about that row would silently move
 * the money somewhere it never was.
 */
export function visibleAccounts(
  accounts: readonly AccountRow[],
  selectedId?: string | null,
): AccountRow[] {
  return accounts.filter((account) => account.is_active || account.id === selectedId);
}

type AccountFieldProps = Omit<React.ComponentProps<"select">, "children"> & {
  accounts: readonly AccountRow[];
  id: string;
  label?: string;
  /** The row's current account, so a closed one stays in the list. */
  selectedId?: string | null;
  hint?: string;
};

export const AccountField = React.forwardRef<HTMLSelectElement, AccountFieldProps>(
  function AccountField(
    { accounts, id, label = "حساب", selectedId, hint, ...props },
    ref,
  ) {
    const options = visibleAccounts(accounts, selectedId);
    if (options.length === 0) return null;

    return (
      <Field label={label} htmlFor={id} hint={hint}>
        <NativeSelect id={id} ref={ref} {...props}>
          {options.map((account) => (
            <option key={account.id} value={account.id}>
              {account.title}
              {account.is_active ? "" : " (بسته)"}
            </option>
          ))}
          {/* Last, not first: money usually moves through an account, and the
              exception should not sit where the eye lands. */}
          <option value="">بدون حساب (نقدی)</option>
        </NativeSelect>
      </Field>
    );
  },
);
