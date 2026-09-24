"use client";

import { useState, useTransition } from "react";
import { quickParse } from "@/lib/entry/quick-parse";
import { toDraft } from "./confirm-card";
import type { SheetState } from "./capture-sheet";

/**
 * Recording a purchase, as a state machine with no opinion about its shape.
 *
 * The bar docked to every page and the capture screen at «/» are the same act
 * at two sizes: a field, the gate, the model, then a sheet to confirm in. Only
 * the markup differs, so only the markup is written twice — and the one thing
 * that would have drifted between two copies, the decision about when a model
 * is worth asking, lives here once.
 *
 * It deliberately does not refresh the router. Both callers do, but the page
 * also puts the cursor back in the field afterwards, and a hook that reached
 * for `useRouter` would be making that decision for them.
 */
export type Capture = {
  text: string;
  setText: (next: string) => void;
  /** What the last attempt refused to do, in the user's own words. */
  error: string | undefined;
  /** The model is reading the text. */
  isReading: boolean;
  sheet: SheetState;
  /** The gate, then the model. Clears the field on both branches. */
  submit: () => void;
  /** A photo, from the camera, the gallery, or a drop. */
  openReceipt: (file: File) => void;
  /** Something dropped that was not an image. */
  refuseFile: () => void;
  /** The sheet is done with. What happens next is the caller's decision. */
  closeSheet: () => void;
};

export function useCapture(): Capture {
  const [text, setText] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [error, setError] = useState<string>();
  const [isReading, startReading] = useTransition();

  function submit() {
    const typed = text.trim();
    if (!typed) return;
    setError(undefined);

    // The gate, before any request. «قهوه ۵» needs no model — it needs two
    // fields filled in, which is faster and free.
    const quick = quickParse(typed);
    if (quick.kind === "manual") {
      setSheet({
        kind: "manual",
        reason: quick.reason,
        amount: quick.amount,
        merchant: quick.merchant,
      });
      setText("");
      return;
    }

    startReading(async () => {
      try {
        const response = await fetch("/api/parse/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: typed }),
        });
        const result = await response.json();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSheet({
          kind: "confirm",
          source: typed,
          drafts: result.transactions.map(toDraft),
        });
        setText("");
      } catch {
        setError("اتصال قطع شد. متن را نگه داشتم؛ دوباره بزن.");
      }
    });
  }

  return {
    text,
    setText,
    error,
    isReading,
    sheet,
    submit,
    // Clears the error on the way in: a refusal about text the user has since
    // abandoned should not still be sitting under a sheet that just opened on
    // a photo instead.
    openReceipt: (file: File) => {
      setError(undefined);
      setSheet({ kind: "receipt", file });
    },
    // Anything else dropped here is a mistake worth naming rather than an
    // upload worth attempting.
    refuseFile: () => setError("این را نخواندم — عکس فاکتور بده."),
    closeSheet: () => setSheet(null),
  };
}
