"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDefaultWorkspace } from "./settings/actions";
import type { WorkspaceId } from "@/lib/workspaces";

/**
 * «Always start me here.»
 *
 * On the chooser rather than buried in settings, because this is the one
 * moment the question is actually in front of the user — asking someone to
 * go and configure away a screen they are looking at is worse than the screen
 * itself. The toggle in settings exists to undo it.
 *
 * It does not navigate. Someone who ticks this is saying something about
 * *next* time, and moving them now would make a preference feel like a
 * button they pressed by accident.
 */
export function RememberWorkspace({
  current,
}: {
  /** What is already remembered, so the control can say so. */
  current: WorkspaceId | null;
}) {
  const router = useRouter();
  const [remembered, setRemembered] = useState(current);
  const [error, setError] = useState<string>();
  const [isSaving, startSaving] = useTransition();

  /**
   * Deliberately not optimistic.
   *
   * A preference is a promise about the future, and this one is kept by the
   * server on the *next* visit — so saying «from now on you go straight
   * there» before the row is written is a sentence the app cannot back. It
   * would also be untestable: the confirmation would appear whether or not
   * anything saved, which is exactly how the first version of this passed a
   * test while writing nothing.
   */
  function remember(workspace: WorkspaceId | null) {
    setError(undefined);
    startSaving(async () => {
      const result = await setDefaultWorkspace(workspace);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setRemembered(workspace);
      router.refresh();
    });
  }

  if (error) {
    return (
      <p role="alert" className="mt-4 text-center text-caption font-medium text-negative">
        {error}
      </p>
    );
  }

  if (remembered) {
    return (
      <p className="mt-4 text-center text-caption text-ink-muted">
        از این به بعد یک‌راست به «{LABELS[remembered]}» می‌روی.{" "}
        <button
          type="button"
          disabled={isSaving}
          onClick={() => remember(null)}
          className="font-semibold text-action hover:underline"
        >
          هر بار بپرس
        </button>
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-caption text-ink-muted">
      <span>هر بار همین‌جا می‌آیی؟ همیشه برو به</span>
      {(["personal", "dong"] as const).map((workspace) => (
        <button
          key={workspace}
          type="button"
          disabled={isSaving}
          onClick={() => remember(workspace)}
          className="rounded-full border border-hairline-strong px-3 py-1 font-semibold text-ink transition-colors hover:border-action hover:text-action"
        >
          {LABELS[workspace]}
        </button>
      ))}
    </div>
  );
}

const LABELS: Record<WorkspaceId, string> = {
  personal: "حسابداری شخصی",
  dong: "دنگ و دونگ",
};
