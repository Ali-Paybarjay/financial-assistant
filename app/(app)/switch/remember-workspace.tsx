"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { setDefaultWorkspace } from "../settings/actions";

/**
 * «When I open the app, take me to دنگ و دونگ.»
 *
 * On the chooser rather than buried in settings, because this is the one
 * moment the question is actually in front of the user. The same switch
 * exists in settings, to undo it somewhere it can be found later.
 *
 * One switch rather than two buttons, because there are only two outcomes
 * now: opening the app lands on the capture screen, or it lands on the trip
 * app. «حسابداری شخصی» is not a third answer — the capture screen *is* the
 * personal side, one tab from its board.
 *
 * It does not navigate. Someone who turns this on is saying something about
 * *next* time, and moving them now would make a preference feel like a button
 * they pressed by accident.
 */
export function RememberWorkspace({ startsInDong }: { startsInDong: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(startsInDong);
  const [error, setError] = useState<string>();
  const [isSaving, startSaving] = useTransition();

  /**
   * Deliberately not optimistic.
   *
   * A preference is a promise about the future, and this one is kept by the
   * server on the *next* visit — so flipping the switch before the row is
   * written is a sentence the app cannot back. It would also be untestable:
   * the new state would appear whether or not anything saved, which is
   * exactly how the first version of this passed a test while writing
   * nothing.
   */
  function remember(next: boolean) {
    setError(undefined);
    startSaving(async () => {
      const result = await setDefaultWorkspace(next ? "dong" : null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setChecked(next);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <label htmlFor="start-in-dong" className="text-caption text-ink-muted">
          وقتی نرم‌افزار را باز می‌کنم، یک‌راست برو به «دنگ و دونگ»
        </label>
        <Switch
          id="start-in-dong"
          checked={checked}
          disabled={isSaving}
          onCheckedChange={remember}
        />
      </div>

      {error && (
        <p role="alert" className="text-caption font-medium text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
