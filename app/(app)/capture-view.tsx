"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Camera, CaretLeft, Images, Spinner } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/money";
import { CaptureSheet, type CaptureData } from "@/components/entry/capture-sheet";
import { useCapture } from "@/components/entry/use-capture";
import type { MonthRemaining } from "@/lib/envelopes";
import type { CurrencyCode } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The first screen: one question, one field, and the number it moves.
 *
 * It is the composer at full size rather than a second implementation of it —
 * both go through useCapture, so the decision about when a model is worth
 * asking is written once. What differs is the room: a three-line field instead
 * of a 42px one, because a sentence can carry several purchases and the parser
 * reads up to ten; and a camera that is a button rather than a 40px glyph,
 * because «I just paid and the receipt is in my hand» is half of why anyone
 * opens this.
 *
 * After a save the sheet closes itself and the cursor comes back here. There
 * is no «go to the dashboard» button, because the sentence above the field is
 * already the way there — and because someone with three receipts should not
 * have to refuse a detour after each one.
 */
export function CaptureView({
  remaining,
  ...data
}: CaptureData & { remaining: MonthRemaining }) {
  const router = useRouter();
  const field = useRef<HTMLTextAreaElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [isDropping, setIsDropping] = useState(false);
  const capture = useCapture();

  /**
   * Focused on a desktop, never on a phone.
   *
   * A keyboard that raises itself over the screen before the person has
   * decided to type is the most likely reason someone would want this whole
   * screen taken back — and on iOS it would not open from script anyway, so
   * the tap it looks like it saves is not saved. On a desktop the field is
   * the only thing on the page and there is no keyboard to get in the way.
   */
  useEffect(() => {
    if (window.matchMedia("(min-width: 960px)").matches) field.current?.focus();
  }, []);

  return (
    <div
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setIsDropping(true);
      }}
      onDragLeave={() => setIsDropping(false)}
      onDrop={(event) => {
        const file = event.dataTransfer.files?.[0];
        setIsDropping(false);
        if (!file) return;
        event.preventDefault();
        if (!file.type.startsWith("image/")) {
          capture.refuseFile();
          return;
        }
        capture.openReceipt(file);
      }}
      className={cn(
        "mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 py-4 transition-colors",
        isDropping && "bg-action-tint",
      )}
    >
      <MonthLine remaining={remaining} currency={data.currency} />

      <div className="flex-1" />

      <h1 className="font-display text-question text-ink">
        <label htmlFor="capture-text">چه خریدی؟</label>
      </h1>
      <p className="mt-1.5 text-caption text-ink-muted">
        بنویس، دیکته کن، یا عکس فاکتور را بده.
      </p>

      <textarea
        ref={field}
        id="capture-text"
        rows={3}
        value={capture.text}
        onChange={(event) => capture.setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            capture.submit();
          }
        }}
        placeholder="بنویس یا دیکته کن"
        // 16px for the same reason the bar's field is: anything smaller makes
        // iOS zoom the page on focus and the user lands on a viewport they did
        // not ask for.
        className="mt-3 h-[100px] w-full resize-none rounded-well border border-hairline-strong bg-surface px-3.5 py-3 text-[16px] leading-[26px] text-ink outline-none transition-colors placeholder:text-ink-faint focus-visible:border-action"
      />

      <Button
        type="button"
        size="lg"
        onClick={capture.submit}
        disabled={capture.isReading || capture.text.trim().length === 0}
        className="mt-3 w-full"
      >
        ثبت
        {capture.isReading ? (
          <Spinner size={18} className="animate-spin" />
        ) : (
          <ArrowUp size={18} weight="bold" />
        )}
      </Button>

      {capture.error && (
        <p role="alert" className="mt-2 text-caption font-medium text-negative">
          {capture.error}
        </p>
      )}

      {/* Typing and photographing are two ways to do the same thing, not a
          primary and a fallback. The rule says so rather than a size
          difference doing it quietly. */}
      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-caption text-ink-faint">یا</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <div className="mt-5 flex gap-2.5">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => camera.current?.click()}
          className="flex-1"
        >
          <Camera size={20} className="text-action" />
          عکس فاکتور
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => gallery.current?.click()}
          className="flex-1"
        >
          <Images size={20} className="text-action" />
          از گالری
        </Button>
      </div>

      {/* Two inputs, not one: `capture` opens the camera and nothing else, so
          a photo already taken needs an input without it. */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) capture.openReceipt(file);
          event.target.value = "";
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) capture.openReceipt(file);
          event.target.value = "";
        }}
      />

      <div className="flex-[0.7]" />

      <CaptureSheet
        state={capture.sheet}
        onClose={() => {
          capture.closeSheet();
          // The month line re-reads, and the cursor comes back to an already
          // empty field — submit() cleared it on the way out.
          router.refresh();
          field.current?.focus();
        }}
        {...data}
      />
    </div>
  );
}

/**
 * What is left of the month, and the way to the page that explains it.
 *
 * One number, not twelve. The board is a tap away and most people will not
 * take it, so this is the whole of what the app tells them about their money
 * on most days — which is the argument for it being the figure that changes a
 * decision at the till, rather than a balance.
 *
 * The link names its destination as well as carrying the sentence: a link
 * whose accessible name is a sentence about money does not say where it goes.
 */
function MonthLine({
  remaining,
  currency,
}: {
  remaining: MonthRemaining;
  currency: CurrencyCode;
}) {
  return (
    <Link
      href="/dashboard"
      className="flex min-h-11 items-start gap-2.5 rounded-card border border-hairline bg-surface px-3.5 py-3 transition-colors hover:border-action hover:bg-action-tint/40"
    >
      <span className="min-w-0 flex-1 text-body text-ink">
        {remaining.kind === "budgeted" ? (
          remaining.remaining > 0 ? (
            <>
              این ماه{" "}
              <Money minor={remaining.remaining} currency={currency} omitSymbol />{" "}
              از <Money minor={remaining.budget} currency={currency} /> بودجه‌ات
              مانده.
            </>
          ) : (
            // Never a negative «remaining»: a minus sign in front of what is
            // left reads as a debt per month, which is not a thing anyone can
            // act on. The sentence changes instead.
            <>
              این ماه{" "}
              <Money
                minor={-remaining.remaining}
                currency={currency}
                className="text-negative"
              />{" "}
              از بودجه‌ات رد شده‌ای.
            </>
          )
        ) : remaining.kind === "spent" ? (
          <>
            این ماه <Money minor={remaining.spent} currency={currency} /> خرج
            کرده‌ای.
          </>
        ) : (
          // A month with no ceilings and no spending. «۰ تومان خرج کرده‌ای» is
          // true and reads as a measurement of something.
          <span className="text-ink-muted">هنوز چیزی برای این ماه ثبت نکرده‌ای.</span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1 pt-0.5 text-caption text-ink-muted">
        داشبورد
        <CaretLeft size={15} className="text-ink-faint" />
      </span>
    </Link>
  );
}
