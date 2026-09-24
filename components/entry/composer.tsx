"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Camera, Spinner } from "@phosphor-icons/react/dist/ssr";
import { TabBar } from "@/components/app-shell/tab-bar";
import { CaptureSheet, type CaptureData } from "./capture-sheet";
import { useCapture } from "./use-capture";
import type { WorkspaceId } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

/**
 * The bar at the bottom of every page, and the tab bar inside it.
 *
 * It replaces the floating button, and the reason is arithmetic rather than
 * taste: recording a purchase used to be a tap to open the sheet, a tap to
 * pick a method, and then typing. Now it is typing. The app's own measure is
 * «a purchase recorded in under ten seconds», and two of those seconds were
 * spent getting to the field.
 *
 * The tab bar lives inside this bar rather than beside it because they are
 * both fixed to the bottom of a phone, and two stacked fixed strips eat a
 * fifth of the screen. One strip, 120px: a 42px field, the four tabs, and
 * whatever the device reserves at the bottom edge.
 *
 * There is no microphone button. Dictation is the keyboard's own, inside this
 * same field — rule 8 — which costs nothing, needs no permission, and lands
 * as editable text rather than behind a transcript.
 *
 * What it does with what is typed lives in useCapture, which «/» uses too:
 * this file is the bar, not the act.
 */
export function Composer({
  workspace,
  ...data
}: CaptureData & { workspace: WorkspaceId }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [isDropping, setIsDropping] = useState(false);
  const capture = useCapture();

  return (
    <>
      {/* Fixed on a phone; from 960px it sits in the flow above the board,
          where there is room for it and nothing to cover — and where a
          receipt can be dropped onto it, which is how a scan arrives on a
          desktop. A phone has no drag and drop and has the camera button
          instead, so the handlers cost it nothing. */}
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
          "fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] transition-colors",
          "min-[960px]:static min-[960px]:z-auto min-[960px]:rounded-card min-[960px]:border",
          isDropping && "min-[960px]:border-action min-[960px]:bg-action-tint",
        )}
      >
        <div className="mx-auto flex max-w-[560px] items-center gap-2 px-3.5 pt-2.5 pb-1 min-[960px]:max-w-none min-[960px]:px-3 min-[960px]:pb-2.5">
          <button
            type="button"
            aria-label="عکس فاکتور"
            onClick={() => fileInput.current?.click()}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-paper text-ink-muted transition-colors hover:text-action"
          >
            <Camera size={20} />
          </button>

          <input
            ref={fileInput}
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

          <label htmlFor="composer-text" className="sr-only">
            چه خریدی؟
          </label>
          <input
            id="composer-text"
            value={capture.text}
            onChange={(event) => capture.setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                capture.submit();
              }
            }}
            placeholder="بنویس یا دیکته کن"
            // 16px, because anything smaller makes iOS zoom the page on
            // focus and the user lands on a viewport they did not ask for.
            // The v3 package has 14px here; that is the one thing of its
            // composer not copied.
            className="h-11 min-w-0 flex-1 rounded-full border border-hairline-strong bg-surface px-4 text-[16px] text-ink outline-none transition-colors placeholder:text-ink-faint focus-visible:border-action"
          />

          <button
            type="button"
            aria-label="ثبت"
            onClick={capture.submit}
            disabled={capture.isReading || capture.text.trim().length === 0}
            className={cn(
              // text-surface rather than a fixed light colour: on --action
              // this is near-white in the light theme and near-black in the
              // dark one, where the accent lightens and a fixed light
              // foreground stops being readable.
              "flex size-11 shrink-0 items-center justify-center rounded-full text-surface transition-colors",
              "bg-action hover:bg-action/90 active:bg-action-pressed",
              "disabled:bg-hairline-strong disabled:text-surface",
            )}
          >
            {capture.isReading ? (
              <Spinner size={20} className="animate-spin" />
            ) : (
              <ArrowUp size={20} weight="bold" />
            )}
          </button>
        </div>

        {capture.error && (
          <p
            role="alert"
            className="mx-auto max-w-[560px] px-4 pb-2 text-caption font-medium text-negative"
          >
            {capture.error}
          </p>
        )}

        {/* Inside the bar, so the phone carries one fixed strip and not two. */}
        <TabBar workspace={workspace} />
      </div>

      <CaptureSheet
        state={capture.sheet}
        onClose={() => {
          capture.closeSheet();
          router.refresh();
        }}
        {...data}
      />
    </>
  );
}
